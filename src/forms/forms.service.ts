import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as fs from 'fs';
import * as path from 'path';

const PDFDocument = require('pdfkit');

@Injectable()
export class FormsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async getFieldTypes() {
    return this.prisma.fieldType.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async findFormByCedis(cedisId: number) {
    let form = await this.prisma.cedisForm.findUnique({
      where: { cedisId: Number(cedisId) },
      include: {
        fields: {
          include: {
            fieldType: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!form) {
      // Create a default form template for the CEDIS if none exists yet
      form = await this.prisma.cedisForm.create({
        data: {
          cedisId: Number(cedisId),
          title: 'Inspección de Unidad',
        },
        include: {
          fields: {
            include: {
              fieldType: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });
    }

    return form;
  }

  async saveFormFields(cedisId: number, fields: { id?: number; label: string; section?: string; options?: string; fieldTypeId: number; isRequired?: boolean }[]) {
    const form = await this.findFormByCedis(cedisId);

    return this.prisma.$transaction(async (tx) => {
      const existingFieldIds = form.fields.map(f => f.id);
      const inputFieldIds = fields.filter(f => f.id).map(f => Number(f.id));

      // 1. Delete fields no longer present in input
      const toDelete = existingFieldIds.filter(id => !inputFieldIds.includes(id));
      if (toDelete.length > 0) {
        await tx.cedisFormField.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // 2. Insert or update the input fields with their sequential order
      let index = 0;
      for (const field of fields) {
        if (field.id) {
          await tx.cedisFormField.update({
            where: { id: Number(field.id) },
            data: {
              label: field.label,
              section: field.section || null,
              options: field.options || null,
              fieldTypeId: Number(field.fieldTypeId),
              isRequired: !!field.isRequired,
              order: index++,
            },
          });
        } else {
          await tx.cedisFormField.create({
            data: {
              formId: form.id,
              label: field.label,
              section: field.section || null,
              options: field.options || null,
              fieldTypeId: Number(field.fieldTypeId),
              isRequired: !!field.isRequired,
              order: index++,
            },
          });
        }
      }

      // Return refreshed form
      return tx.cedisForm.findUnique({
        where: { id: form.id },
        include: {
          fields: {
            include: { fieldType: true },
            orderBy: { order: 'asc' },
          },
        },
      });
    });
  }

  async submitResponse(userId: number, data: { date: string; shiftId: number; vehicleId: number; answers: { fieldId: number; value: string }[] }) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: Number(data.vehicleId) },
    });

    if (!vehicle) {
      throw new NotFoundException(`Unidad con ID ${data.vehicleId} no encontrada.`);
    }

    if (!vehicle.currentCedisId) {
      throw new BadRequestException(`La unidad #${vehicle.truckNumber} no tiene un CEDIS asignado actualmente.`);
    }

    const form = await this.findFormByCedis(vehicle.currentCedisId);
    const date = new Date(`${data.date}T00:00:00.000Z`);
    const shiftId = Number(data.shiftId);
    const vehicleId = Number(data.vehicleId);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Upsert response header
      const response = await tx.vehicleShiftFormResponse.upsert({
        where: {
          date_shiftId_vehicleId: {
            date,
            shiftId,
            vehicleId,
          },
        },
        update: {
          userId,
        },
        create: {
          form: { connect: { id: form.id } },
          date,
          shift: { connect: { id: shiftId } },
          vehicle: { connect: { id: vehicleId } },
          user: { connect: { id: userId } },
        },
      });

      // 2. Delete existing responses for this form response
      await tx.formFieldResponse.deleteMany({
        where: { responseId: response.id },
      });

      // 3. Create new responses
      if (data.answers && data.answers.length > 0) {
        await tx.formFieldResponse.createMany({
          data: data.answers.map((a) => ({
            responseId: response.id,
            fieldId: Number(a.fieldId),
            value: a.value,
          })),
        });
      }

      return response;
    });

    // 4. Generate PDF after transaction completes
    try {
      const localFilePath = await this.generateInspectionPdf(result.id, vehicle, data.date, shiftId, form, data.answers);
      let pdfUrl = `/uploads/inspections/${path.basename(localFilePath)}`;

      if (process.env.STORAGE_TYPE === 'GCS' || process.env.GCS_BUCKET_NAME) {
        try {
          if (fs.existsSync(localFilePath)) {
            const fileBuffer = fs.readFileSync(localFilePath);
            const fileMock = {
              buffer: fileBuffer,
              originalname: path.basename(localFilePath),
              mimetype: 'application/pdf',
            } as Express.Multer.File;

            pdfUrl = await this.storageService.uploadFile(fileMock, 'inspections');

            // Cleanup local temporary file
            try {
              fs.unlinkSync(localFilePath);
            } catch (err) {
              console.error('Error deleting local temp pdf:', err);
            }
          }
        } catch (uploadError) {
          console.error('Error uploading PDF to GCS:', uploadError);
        }
      }

      // Update the response record with the PDF URL
      await this.prisma.vehicleShiftFormResponse.update({
        where: { id: result.id },
        data: { pdfUrl },
      });

      return { success: true, responseId: result.id, pdfUrl };
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      // Return success even if PDF generation fails
      return { success: true, responseId: result.id };
    }
  }

  private async generateInspectionPdf(
    responseId: number,
    vehicle: any,
    dateStr: string,
    shiftId: number,
    form: any,
    answers: { fieldId: number; value: string }[],
  ): Promise<string> {
    // Ensure directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'inspections');
    fs.mkdirSync(uploadsDir, { recursive: true });

    // Fetch operator and shift details
    const response = await this.prisma.vehicleShiftFormResponse.findUnique({
      where: { id: responseId },
      include: {
        user: true,
        shift: true,
        vehicle: true,
      },
    });

    const operatorName = response?.user?.name || 'Administrador Principal';
    const shiftName = response?.shift?.name || `Turno ${shiftId}`;

    // Build filename
    const safeDateStr = dateStr.replace(/[\/\\:]/g, '-');
    const fileName = `inspeccion_${vehicle.id}_${safeDateStr}_${shiftId}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    // Build answer map: fieldId -> value
    const answerMap = new Map<number, string>();
    for (const a of answers) {
      answerMap.set(Number(a.fieldId), a.value);
    }

    // Create PDF
    return new Promise<string>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
      const writeStream = fs.createWriteStream(filePath);

      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', (err) => reject(err));

      doc.pipe(writeStream);

      // Helper function to draw page background & footer decorations
      const drawPageDecorations = (pdfDoc: any) => {
        pdfDoc.save();
        // Top-right red polygon
        pdfDoc.polygon([440, 0], [612, 0], [612, 90], [390, 90]).fill('#F51720');
        // Top-right navy stripe
        pdfDoc.polygon([435, 0], [440, 0], [390, 90], [385, 90]).fill('#0A1931');
        
        // Bottom navy bar
        pdfDoc.rect(0, 770, 612, 22).fill('#0A1931');
        // Bottom-left navy stripe
        pdfDoc.polygon([0, 715], [185, 792], [180, 792], [0, 720]).fill('#0A1931');
        // Bottom-left red triangle
        pdfDoc.polygon([0, 720], [180, 792], [0, 792]).fill('#F51720');
        
        // Footer text inside the navy bar
        pdfDoc.font('Helvetica').fontSize(7.5).fillColor('#FFFFFF').text(
          `Generado automáticamente el ${new Date().toLocaleString('es-MX')} — ID de inspección: ${responseId}`,
          50,
          777,
          { width: 512, align: 'center' }
        );
        pdfDoc.restore();
      };

      // Draw background decorations on first page
      drawPageDecorations(doc);

      // Draw COORSA Logo
      const logoPath = path.join(process.cwd(), 'uploads', 'logo_coorsa.jpeg');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, 18, { width: 110 });
        } catch (err) {
          console.error('Error drawing image logo, falling back to vector:', err);
          // Vector Fallback
          doc.fillColor('#0A1931').font('Helvetica-Bold').fontSize(22).text('COORS', 50, 25);
          doc.save();
          doc.polygon([138, 26], [147, 43], [129, 43]).fill('#F51720');
          doc.moveTo(133, 38).lineTo(143, 38).strokeColor('#FFFFFF').lineWidth(1.8).stroke();
          doc.restore();
          doc.fillColor('#0A1931').font('Helvetica-Bold').fontSize(6).text('S O L U C I O N E S   L O G Í S T I C A S', 50, 48);
        }
      } else {
        // Vector Fallback
        doc.fillColor('#0A1931').font('Helvetica-Bold').fontSize(22).text('COORS', 50, 25);
        doc.save();
        doc.polygon([138, 26], [147, 43], [129, 43]).fill('#F51720');
        doc.moveTo(133, 38).lineTo(143, 38).strokeColor('#FFFFFF').lineWidth(1.8).stroke();
        doc.restore();
        doc.fillColor('#0A1931').font('Helvetica-Bold').fontSize(6).text('S O L U C I O N E S   L O G Í S T I C A S', 50, 48);
      }

      // Title next to the logo
      doc.fillColor('#0A1931').font('Helvetica-Bold').fontSize(20).text('CHECKLIST QUINTAS', 175, 26);

      // DATOS GENERALES subtitle
      doc.fillColor('#0A1931').font('Helvetica-Bold').fontSize(11).text('DATOS GENERALES', 50, 100, { width: 512, align: 'center' });

      // Draw metadata general info
      const drawMeta = (label: string, value: string, x: number, y: number, fieldWidth: number, labelWidth: number) => {
        doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0A1931').text(label, x, y);
        doc.font('Helvetica').fontSize(8.2).fillColor('#333333').text(value, x + labelWidth, y, { width: fieldWidth - labelWidth });
        doc.moveTo(x + labelWidth - 2, y + 10).lineTo(x + fieldWidth, y + 10).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
      };

      const fields = form.fields || [];

      // Format time
      const createdAt = response?.createdAt ? new Date(response.createdAt) : new Date();
      const horaVal = createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

      drawMeta('FECHA:', safeDateStr, 50, 118, 160, 38);
      drawMeta('N° ECO:', vehicle.truckNumber || 'N/A', 226, 118, 160, 38);
      drawMeta('TURNO:', shiftName.toUpperCase(), 402, 118, 160, 42);
      
      drawMeta('OPERADOR:', operatorName, 50, 138, 336, 58);
      drawMeta('HORA:', horaVal, 402, 138, 160, 34);

      // Separate standard fields and wide fields
      const sections = new Map<string, any[]>();
      const wideFields: any[] = [];
      const imagesToAppend: { label: string; filePath: string }[] = [];

      for (const field of fields) {
        const fieldTypeName = field.fieldType?.name?.toUpperCase() || '';
        const value = answerMap.get(field.id) || '';

        // Collect images for appendix
        if (fieldTypeName === 'IMAGE' || fieldTypeName === 'DOCUMENT') {
          const urls = value.split(',').map((u) => u.trim()).filter(Boolean);
          for (let idx = 0; idx < urls.length; idx++) {
            const url = urls[idx];
            if (url.startsWith('/uploads/')) {
              const absPath = path.join(process.cwd(), url);
              if (fieldTypeName === 'IMAGE') {
                imagesToAppend.push({
                  label: urls.length > 1 ? `${field.label} (${idx + 1})` : field.label,
                  filePath: absPath,
                });
              }
            }
          }
        }

        if (fieldTypeName === 'SIGNATURE' || fieldTypeName === 'LONGTEXT') {
          wideFields.push(field);
        } else {
          const sectionName = field.section || 'General';
          if (!sections.has(sectionName)) {
            sections.set(sectionName, []);
          }
          sections.get(sectionName)!.push(field);
        }
      }

      // Draw standard fields in 3 columns
      const columnWidth = 160;
      const colX = [50, 226, 402];
      const colY = [168, 168, 168];

      for (const [sectionName, sectionFields] of sections) {
        // Find column with minimum Y
        let minColIdx = 0;
        let minY = colY[0];
        for (let i = 1; i < colY.length; i++) {
          if (colY[i] < minY) {
            minY = colY[i];
            minColIdx = i;
          }
        }

        const x = colX[minColIdx];
        let y = colY[minColIdx];

        // Draw Section Header
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0A1931').text(sectionName.toUpperCase(), x, y);
        y = doc.y + 1;
        doc.moveTo(x, y).lineTo(x + columnWidth, y).strokeColor('#0A1931').lineWidth(0.8).stroke();
        y += 4;

        // Draw Section Fields
        for (const field of sectionFields) {
          const value = answerMap.get(field.id) || '';
          const fieldTypeName = field.fieldType?.name?.toUpperCase() || '';

          if (fieldTypeName === 'CHECK') {
            // Draw Checkbox Vector
            doc.save();
            doc.rect(x, y + 1, 8, 8).strokeColor('#0A1931').lineWidth(0.8).stroke();
            const isChecked = value === 'true' || value === '1';
            if (isChecked) {
              // Green Check
              doc.moveTo(x + 1.5, y + 4.5)
                 .lineTo(x + 3.5, y + 6.5)
                 .lineTo(x + 6.5, y + 2.5)
                 .strokeColor('#008000')
                 .lineWidth(1.2)
                 .stroke();
            } else {
              // Red Cross
              doc.moveTo(x + 2, y + 2)
                 .lineTo(x + 6, y + 6)
                 .moveTo(x + 6, y + 2)
                 .lineTo(x + 2, y + 6)
                 .strokeColor('#F51720')
                 .lineWidth(1.2)
                 .stroke();
            }
            doc.restore();

            doc.font('Helvetica').fontSize(8).fillColor('#333333').text(field.label, x + 12, y, { width: columnWidth - 12 });
            y = doc.y + 2;
          } else {
            // Draw standard text/select fields
            let displayVal = value || 'N/A';
            if (fieldTypeName === 'IMAGE') {
              const count = value.split(',').filter(Boolean).length;
              displayVal = count > 0 ? `📷 [${count} img]` : 'Sin imagen';
            } else if (fieldTypeName === 'DOCUMENT') {
              const count = value.split(',').filter(Boolean).length;
              displayVal = count > 0 ? `📄 [${count} doc]` : 'Sin doc';
            }

            doc.font('Helvetica-Bold').fontSize(8).fillColor('#0A1931').text(`${field.label}: `, x, y, { width: columnWidth, continued: true });
            doc.font('Helvetica').fontSize(8).fillColor('#333333').text(displayVal);
            y = doc.y + 2;
          }
        }

        y += 8; // section gap
        colY[minColIdx] = y;
      }

      // Render wide fields (Signature, Comments/LongText)
      let currentY = Math.max(...colY) + 15;

      if (wideFields.length > 0) {
        if (currentY > 580) {
          doc.addPage();
          drawPageDecorations(doc);
          currentY = 110;
        }

        for (const field of wideFields) {
          const value = answerMap.get(field.id) || '';
          const fieldTypeName = field.fieldType?.name?.toUpperCase() || '';

          if (fieldTypeName === 'LONGTEXT') {
            if (currentY + 65 > 730) {
              doc.addPage();
              drawPageDecorations(doc);
              currentY = 110;
            }

            doc.save();
            doc.rect(50, currentY, 512, 55).fillColor('#F9F9F9').strokeColor('#E0E0E0').lineWidth(0.5).fillAndStroke();
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0A1931').text(field.label.toUpperCase(), 58, currentY + 6);
            doc.font('Helvetica').fontSize(8).fillColor('#333333').text(value || 'Sin observaciones.', 58, currentY + 18, { width: 496, height: 32 });
            doc.restore();
            currentY += 65;
          } else if (fieldTypeName === 'SIGNATURE') {
            if (currentY + 95 > 730) {
              doc.addPage();
              drawPageDecorations(doc);
              currentY = 110;
            }

            let sigBuffer: Buffer | null = null;
            if (value) {
              try {
                if (value.startsWith('data:image')) {
                  const base64Data = value.replace(/^data:image\/\w+;base64,/, '');
                  sigBuffer = Buffer.from(base64Data, 'base64');
                } else if (value.startsWith('/uploads/')) {
                  const absPath = path.join(process.cwd(), value);
                  if (fs.existsSync(absPath)) {
                    sigBuffer = fs.readFileSync(absPath);
                  }
                } else {
                  sigBuffer = Buffer.from(value, 'base64');
                }
              } catch (err) {
                console.error('Error loading signature image:', err);
              }
            }

            const boxX = 186; // Centered 240px wide box
            doc.save();
            doc.rect(boxX, currentY, 240, 70).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
            if (sigBuffer) {
              try {
                doc.image(sigBuffer, boxX + 5, currentY + 5, { fit: [230, 60], align: 'center', valign: 'center' });
              } catch (e) {
                console.error('Error drawing signature image:', e);
              }
            }
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#0A1931').text(field.label.toUpperCase(), boxX, currentY + 75, { width: 240, align: 'center' });
            doc.restore();
            currentY += 95;
          }
        }
      }

      // Appendix: Photographic Evidence
      if (imagesToAppend.length > 0) {
        doc.addPage();
        drawPageDecorations(doc);

        doc.font('Helvetica-Bold').fontSize(14).fillColor('#0A1931').text('EVIDENCIAS FOTOGRÁFICAS', 50, 110, { align: 'center' });
        
        let currentEvY = 135;
        for (const img of imagesToAppend) {
          if (fs.existsSync(img.filePath)) {
            if (currentEvY > 550) {
              doc.addPage();
              drawPageDecorations(doc);
              doc.font('Helvetica-Bold').fontSize(14).fillColor('#0A1931').text('EVIDENCIAS FOTOGRÁFICAS (CONT.)', 50, 110, { align: 'center' });
              currentEvY = 135;
            }

            try {
              doc.font('Helvetica-Bold').fontSize(9).fillColor('#0A1931').text(img.label.toUpperCase(), 50, currentEvY);
              currentEvY += 12;

              doc.image(img.filePath, 50, currentEvY, {
                fit: [300, 160],
                align: 'left',
              });
              currentEvY += 175;
            } catch (err) {
              console.error(`Error loading image in PDF:`, err);
              doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#F51720').text(`[Error cargando imagen: ${path.basename(img.filePath)}]`, 50, currentEvY);
              currentEvY += 20;
            }
          }
        }
      }

      doc.end();
    });
  }

  async findResponse(dateStr: string, shiftId: number, vehicleId: number) {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    return this.prisma.vehicleShiftFormResponse.findUnique({
      where: {
        date_shiftId_vehicleId: {
          date,
          shiftId: Number(shiftId),
          vehicleId: Number(vehicleId),
        },
      },
      include: {
        answers: true,
      },
    });
  }

  async findCompletedVehicleIds(cedisId: number, dateStr: string, shiftId: number): Promise<number[]> {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const responses = await this.prisma.vehicleShiftFormResponse.findMany({
      where: {
        date,
        shiftId: Number(shiftId),
        form: {
          cedisId: Number(cedisId),
        },
      },
      select: {
        vehicleId: true,
      },
    });
    return responses.map((r) => r.vehicleId);
  }

  async findInspectionsByVehicle(vehicleId: number) {
    return this.prisma.vehicleShiftFormResponse.findMany({
      where: { vehicleId: Number(vehicleId) },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        shiftId: true,
        shift: { select: { name: true } },
        userId: true,
        user: { select: { name: true } },
        pdfUrl: true,
        createdAt: true,
        answers: {
          select: {
            id: true,
            fieldId: true,
            value: true,
            field: {
              select: {
                id: true,
                label: true,
                section: true,
                options: true,
                fieldType: {
                  select: {
                    id: true,
                    name: true,
                    label: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findInspectionPdfPath(responseId: number): Promise<string> {
    const response = await this.prisma.vehicleShiftFormResponse.findUnique({
      where: { id: Number(responseId) },
      select: { pdfUrl: true },
    });

    if (!response || !response.pdfUrl) {
      throw new NotFoundException(`No se encontró el PDF para la inspección con ID ${responseId}.`);
    }

    // pdfUrl is stored as "/uploads/inspections/filename.pdf"
    // Convert to absolute file path
    const absolutePath = path.join(process.cwd(), response.pdfUrl);

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException(`El archivo PDF no existe en disco.`);
    }

    return absolutePath;
  }

  async findInspectionById(responseId: number) {
    return this.prisma.vehicleShiftFormResponse.findUnique({
      where: { id: Number(responseId) },
      include: {
        form: true,
      },
    });
  }

  async getInspectionPdfViewUrl(pdfUrl: string): Promise<string> {
    return this.storageService.getViewUrl(pdfUrl);
  }

  async deleteInspection(responseId: number) {
    const response = await this.findInspectionById(responseId);
    if (!response) {
      throw new NotFoundException('Inspección no encontrada.');
    }

    if (response.pdfUrl) {
      if (response.pdfUrl.startsWith('http')) {
        // GCS file
        try {
          await this.storageService.deleteFile(response.pdfUrl);
        } catch (err) {
          console.error('Error deleting PDF from GCS during inspection deletion:', err);
        }
      } else {
        // Local file
        try {
          const absolutePath = path.join(process.cwd(), response.pdfUrl);
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
          }
        } catch (err) {
          console.error('Error deleting local PDF file during inspection deletion:', err);
        }
      }
    }

    return this.prisma.vehicleShiftFormResponse.delete({
      where: { id: Number(responseId) },
    });
  }
}

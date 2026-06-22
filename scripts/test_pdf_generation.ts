import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FormsService } from '../src/forms/forms.service';
import { PrismaService } from '../src/prisma/prisma.service';
import * as fs from 'fs';

async function main() {
  console.log('Iniciando prueba de generación de PDF...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const formsService = app.get(FormsService);
  const prisma = app.get(PrismaService);

  // Get a vehicle, shift, user to create a mock response
  const vehicle = await prisma.vehicle.findFirst();
  const shift = await prisma.shift.findFirst();
  const user = await prisma.user.findFirst();

  if (!vehicle || !shift || !user) {
    console.error('No se pudo encontrar vehículo, turno o usuario en la base de datos.');
    await app.close();
    return;
  }

  // Get GDL form
  const form = await formsService.findFormByCedis(2); // GDL form
  if (!form || !form.fields || form.fields.length === 0) {
    console.error('No se encontró el formulario de GDL.');
    await app.close();
    return;
  }

  console.log(`Generando PDF para vehículo ${vehicle.truckNumber}...`);

  // Mock answers mapping GDL fields
  const answers = form.fields.map(f => {
    let value = '';
    const fieldTypeName = f.fieldType?.name?.toUpperCase();
    if (fieldTypeName === 'CHECK') {
      value = Math.random() > 0.25 ? 'true' : 'false';
    } else if (fieldTypeName === 'NUMBER') {
      value = '54321';
    } else if (fieldTypeName === 'SELECT') {
      if (f.label.toLowerCase().includes('gasolina')) {
        value = '1/2';
      } else {
        value = 'OPERATIVA';
      }
    } else if (fieldTypeName === 'LONGTEXT') {
      value = 'Vehículo en excelentes condiciones. Se detectó una presión ligeramente baja en llantas traseras pero fue corregida.';
    } else if (fieldTypeName === 'SIGNATURE') {
      value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
    return {
      fieldId: f.id,
      value
    };
  });

  const dateStr = '2026-06-22';
  
  const testResponse = await prisma.vehicleShiftFormResponse.upsert({
    where: {
      date_shiftId_vehicleId: {
        date: new Date(`${dateStr}T00:00:00.000Z`),
        shiftId: shift.id,
        vehicleId: vehicle.id
      }
    },
    update: {},
    create: {
      formId: form.id,
      date: new Date(`${dateStr}T00:00:00.000Z`),
      shiftId: shift.id,
      vehicleId: vehicle.id,
      userId: user.id
    }
  });

  const filePath = await (formsService as any).generateInspectionPdf(
    testResponse.id,
    vehicle,
    dateStr,
    shift.id,
    form,
    answers
  );

  console.log(`PDF Generado con éxito en: ${filePath}`);
  await app.close();
}

main().catch(err => {
  console.error('Error in PDF generation script:', err);
});

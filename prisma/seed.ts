import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create super admin
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { loginid: 'admin' },
    update: {},
    create: {
      userid: 'ADMIN001',
      username: 'Super Admin',
      loginid: 'admin',
      password: hashedPassword,
      role: 'admin',
      isSuperAdmin: true,
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
    },
  });
  console.log('✅ Created super admin:', admin.username);

  // Create TDL users
  const tdlPassword = await bcrypt.hash('tdl123', 12);
  const tdl1 = await prisma.user.upsert({
    where: { loginid: 'tdl1' },
    update: {},
    create: {
      userid: 'TDL001',
      username: 'TDL North',
      loginid: 'tdl1',
      password: tdlPassword,
      role: 'TDL',
      leader: 'Super Admin',
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
    },
  });

  const tdl2 = await prisma.user.upsert({
    where: { loginid: 'tdl2' },
    update: {},
    create: {
      userid: 'TDL002',
      username: 'TDL South',
      loginid: 'tdl2',
      password: tdlPassword,
      role: 'TDL',
      leader: 'Super Admin',
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
    },
  });
  console.log('✅ Created TDL users');

  // Create TDS users
  const tdsPassword = await bcrypt.hash('tds123', 12);
  const tds1 = await prisma.user.upsert({
    where: { loginid: 'tds1' },
    update: {},
    create: {
      userid: 'TDS001',
      username: 'TDS Region A',
      loginid: 'tds1',
      password: tdsPassword,
      role: 'TDS',
      leader: 'TDL North',
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
    },
  });

  const tds2 = await prisma.user.upsert({
    where: { loginid: 'tds2' },
    update: {},
    create: {
      userid: 'TDS002',
      username: 'TDS Region B',
      loginid: 'tds2',
      password: tdsPassword,
      role: 'TDS',
      leader: 'TDL South',
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
    },
  });
  console.log('✅ Created TDS users');

  // Create PRT users
  const prtPassword = await bcrypt.hash('prt123', 12);
  const prt1 = await prisma.user.upsert({
    where: { loginid: 'prt1' },
    update: {},
    create: {
      userid: 'PRT001',
      username: 'PRT User 1',
      loginid: 'prt1',
      password: prtPassword,
      role: 'PRT',
      leader: 'TDS Region A',
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
    },
  });

  const prt2 = await prisma.user.upsert({
    where: { loginid: 'prt2' },
    update: {},
    create: {
      userid: 'PRT002',
      username: 'PRT User 2',
      loginid: 'prt2',
      password: prtPassword,
      role: 'PRT',
      leader: 'TDS Region B',
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
    },
  });
  console.log('✅ Created PRT users');

  // Create stores
  const stores = [
    {
      storeId: 'STR001',
      storeCode: 'HN001',
      storeName: 'Hanoi Central Store',
      channel: 'GT',
      hc: 5000000,
      region: 'North',
      province: 'Hanoi',
      mcp: 'Y',
      tdl: 'TDL001',
      tds: 'TDS001',
    },
    {
      storeId: 'STR002',
      storeCode: 'HN002',
      storeName: 'Hanoi Mega Mart',
      channel: 'MT',
      hc: 8000000,
      region: 'North',
      province: 'Hanoi',
      mcp: 'Y',
      tdl: 'TDL001',
      tds: 'TDS001',
    },
    {
      storeId: 'STR003',
      storeCode: 'HCM001',
      storeName: 'Ho Chi Minh City Central',
      channel: 'GT',
      hc: 6000000,
      region: 'South',
      province: 'Ho Chi Minh',
      mcp: 'Y',
      tdl: 'TDL002',
      tds: 'TDS002',
    },
    {
      storeId: 'STR004',
      storeCode: 'DN001',
      storeName: 'Da Nang Supermarket',
      channel: 'MT',
      hc: 4500000,
      region: 'Central',
      province: 'Da Nang',
      mcp: 'N',
      tdl: 'TDL001',
      tds: 'TDS001',
    },
    {
      storeId: 'STR005',
      storeCode: 'HP001',
      storeName: 'Hai Phong Retail',
      channel: 'GT',
      hc: 3500000,
      region: 'North',
      province: 'Hai Phong',
      mcp: 'Y',
      tdl: 'TDL001',
      tds: 'TDS001',
    },
    {
      storeId: 'STR006',
      storeCode: 'CT001',
      storeName: 'Can Tho Market',
      channel: 'GT',
      hc: 4000000,
      region: 'South',
      province: 'Can Tho',
      mcp: 'N',
      tdl: 'TDL002',
      tds: 'TDS002',
    },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { storeId: store.storeId },
      update: {},
      create: {
        ...store,
        isActive: true,
        createdBy: 'system',
        updatedBy: 'system',
      },
    });
  }
  console.log('✅ Created stores');

  // Assign stores to users
  await prisma.user.update({
    where: { id: prt1.id },
    data: {
      assignedStores: {
        connect: [
          { storeId: 'STR001' },
          { storeId: 'STR002' },
          { storeId: 'STR004' },
        ],
      },
    },
  });

  await prisma.user.update({
    where: { id: prt2.id },
    data: {
      assignedStores: {
        connect: [
          { storeId: 'STR003' },
          { storeId: 'STR005' },
          { storeId: 'STR006' },
        ],
      },
    },
  });
  console.log('✅ Assigned stores to users');

  // Create Model POSM mappings
  const modelPosms = [
    { model: 'Coca-Cola 330ml', posm: 'POSM001', posmName: 'Display Stand Small', category: 'Beverage', project: 'Summer 2024' },
    { model: 'Coca-Cola 500ml', posm: 'POSM002', posmName: 'Display Stand Medium', category: 'Beverage', project: 'Summer 2024' },
    { model: 'Coca-Cola 1L', posm: 'POSM003', posmName: 'Display Stand Large', category: 'Beverage', project: 'Summer 2024' },
    { model: 'Sprite 330ml', posm: 'POSM001', posmName: 'Display Stand Small', category: 'Beverage', project: 'Summer 2024' },
    { model: 'Sprite 500ml', posm: 'POSM002', posmName: 'Display Stand Medium', category: 'Beverage', project: 'Summer 2024' },
    { model: 'Fanta 330ml', posm: 'POSM001', posmName: 'Display Stand Small', category: 'Beverage', project: 'Summer 2024' },
    { model: 'Fanta 500ml', posm: 'POSM004', posmName: 'Cooler Display', category: 'Beverage', project: 'Summer 2024' },
    { model: 'Minute Maid 250ml', posm: 'POSM005', posmName: 'Shelf Talker', category: 'Juice', project: 'Summer 2024' },
    { model: 'Minute Maid 1L', posm: 'POSM006', posmName: 'Floor Display', category: 'Juice', project: 'Summer 2024' },
    { model: 'Aquarius 500ml', posm: 'POSM007', posmName: 'Door Decal', category: 'Water', project: 'Summer 2024' },
  ];

  for (const mp of modelPosms) {
    await prisma.modelPosm.upsert({
      where: { model_posm: { model: mp.model, posm: mp.posm } },
      update: {},
      create: mp,
    });
  }
  console.log('✅ Created Model POSM mappings');

  // Create sample displays
  const displays = [
    { storeId: 'STR001', model: 'Coca-Cola 330ml', isDisplayed: true, userId: prt1.id },
    { storeId: 'STR001', model: 'Coca-Cola 500ml', isDisplayed: true, userId: prt1.id },
    { storeId: 'STR002', model: 'Sprite 330ml', isDisplayed: false, userId: prt1.id },
    { storeId: 'STR003', model: 'Fanta 330ml', isDisplayed: true, userId: prt2.id },
    { storeId: 'STR003', model: 'Fanta 500ml', isDisplayed: true, userId: prt2.id },
  ];

  for (const display of displays) {
    const existing = await prisma.display.findFirst({
      where: { storeId: display.storeId, model: display.model },
    });
    if (!existing) {
      await prisma.display.create({
        data: {
          ...display,
          createdBy: 'system',
          updatedBy: 'system',
        },
      });
    }
  }
  console.log('✅ Created displays');

  // Create sample survey responses
  const surveyResponses = [
    {
      leader: 'TDS Region A',
      shopName: 'Hanoi Central Store',
      storeId: 'STR001',
      submittedById: prt1.id,
      submittedBy: 'PRT User 1',
      submittedByRole: 'PRT',
      responses: JSON.stringify([
        {
          model: 'Coca-Cola 330ml',
          quantity: 2,
          posmSelections: [
            { posmCode: 'POSM001', posmName: 'Display Stand Small', selected: true },
          ],
          allSelected: true,
          images: [],
        },
      ]),
    },
    {
      leader: 'TDS Region B',
      shopName: 'Ho Chi Minh City Central',
      storeId: 'STR003',
      submittedById: prt2.id,
      submittedBy: 'PRT User 2',
      submittedByRole: 'PRT',
      responses: JSON.stringify([
        {
          model: 'Fanta 330ml',
          quantity: 1,
          posmSelections: [
            { posmCode: 'POSM001', posmName: 'Display Stand Small', selected: true },
          ],
          allSelected: false,
          images: [],
        },
        {
          model: 'Fanta 500ml',
          quantity: 3,
          posmSelections: [
            { posmCode: 'POSM004', posmName: 'Cooler Display', selected: true },
          ],
          allSelected: true,
          images: [],
        },
      ]),
    },
  ];

  for (const sr of surveyResponses) {
    await prisma.surveyResponse.create({
      data: sr,
    });
  }
  console.log('✅ Created survey responses');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

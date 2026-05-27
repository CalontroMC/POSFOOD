export const categories = [
  { id: "all", name: "ทั้งหมด" },
  { id: "dessert", name: "ขนมและของหวาน" },
  { id: "drinks", name: "เครื่องดื่ม" },
  { id: "fried", name: "ของทอด" },
  { id: "mains", name: "อาหารจานเดียว" },
];

export const menuItems = [
  {
    id: 1,
    name: "ข้าวกะเพราหมูสับ",
    category: "mains",
    categoryLabel: "อาหารจานเดียว",
    price: 60,
    points: 2,
    image:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 2,
    name: "ข้าวผัดกุ้ง",
    category: "mains",
    categoryLabel: "อาหารจานเดียว",
    price: 80,
    points: 3,
    image:
      "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 3,
    name: "ผัดไทยกุ้งสด",
    category: "mains",
    categoryLabel: "อาหารจานเดียว",
    price: 75,
    points: 3,
    image:
      "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 4,
    name: "ไก่ทอดน้ำปลา",
    category: "fried",
    categoryLabel: "ของทอด",
    price: 90,
    points: 3,
    image:
      "https://images.unsplash.com/photo-1626082896492-766af4eb6501?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 5,
    name: "เฟรนช์ฟรายส์",
    category: "fried",
    categoryLabel: "ของทอด",
    price: 45,
    points: 1,
    image:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 6,
    name: "ปอเปี๊ยะทอด",
    category: "fried",
    categoryLabel: "ของทอด",
    price: 50,
    points: 1,
    image:
      "https://images.unsplash.com/photo-1606851179386-29a3b3007ffd?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 7,
    name: "ชาไทยเย็น",
    category: "drinks",
    categoryLabel: "เครื่องดื่ม",
    price: 35,
    points: 1,
    image:
      "https://images.unsplash.com/photo-1558857563-c0c6c4b39b8e?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 8,
    name: "กาแฟเย็น",
    category: "drinks",
    categoryLabel: "เครื่องดื่ม",
    price: 40,
    points: 1,
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 9,
    name: "น้ำมะนาวโซดา",
    category: "drinks",
    categoryLabel: "เครื่องดื่ม",
    price: 45,
    points: 1,
    image:
      "https://images.unsplash.com/photo-1622597468968-475db75a4daa?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 10,
    name: "บัวลอยน้ำขิง",
    category: "dessert",
    categoryLabel: "ขนมและของหวาน",
    price: 55,
    points: 2,
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 11,
    name: "ข้าวเหนียวมะม่วง",
    category: "dessert",
    categoryLabel: "ขนมและของหวาน",
    price: 70,
    points: 2,
    image:
      "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?auto=format&fit=crop&w=600&q=70",
  },
  {
    id: 12,
    name: "ไอศกรีมกะทิ",
    category: "dessert",
    categoryLabel: "ขนมและของหวาน",
    price: 40,
    points: 1,
    image:
      "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=70",
  },
];

export const tables = [
  { id: "A1", name: "A1", seats: 2, zone: "ในร้าน", status: "ว่าง" },
  { id: "A2", name: "A2", seats: 4, zone: "ในร้าน", status: "มีลูกค้า" },
  { id: "A3", name: "A3", seats: 4, zone: "ในร้าน", status: "ว่าง" },
  { id: "A4", name: "A4", seats: 2, zone: "ในร้าน", status: "จองแล้ว" },
  { id: "B1", name: "B1", seats: 6, zone: "ในร้าน", status: "ว่าง" },
  { id: "B2", name: "B2", seats: 6, zone: "ในร้าน", status: "มีลูกค้า" },
  { id: "C1", name: "C1", seats: 4, zone: "นอกร้าน", status: "ว่าง" },
  { id: "C2", name: "C2", seats: 4, zone: "นอกร้าน", status: "มีลูกค้า" },
  { id: "D1", name: "D1", seats: 2, zone: "มุมนอกร้าน", status: "จองแล้ว" },
  { id: "D2", name: "D2", seats: 2, zone: "มุมนอกร้าน", status: "ว่าง" },
  { id: "D3", name: "D3", seats: 4, zone: "มุมนอกร้าน", status: "ว่าง" },
  { id: "D4", name: "D4", seats: 8, zone: "มุมนอกร้าน", status: "มีลูกค้า" },
];

export const members = [
  { id: 1, name: "สมชาย ใจดี", phone: "081-234-5678", points: 320, spending: 4580, visits: 18, color: "bg-orange-500" },
  { id: 2, name: "สมหญิง รักษ์ดี", phone: "082-345-6789", points: 180, spending: 2640, visits: 9, color: "bg-purple-500" },
  { id: 3, name: "วันชัย สุขใจ", phone: "083-456-7890", points: 540, spending: 7220, visits: 27, color: "bg-emerald-500" },
  { id: 4, name: "นพดล มั่นคง", phone: "084-567-8901", points: 95, spending: 1280, visits: 5, color: "bg-pink-500" },
  { id: 5, name: "พิมพ์ภรณ์ ศรีสุข", phone: "085-678-9012", points: 410, spending: 5970, visits: 22, color: "bg-blue-500" },
  { id: 6, name: "อรุณ ทองดี", phone: "086-789-0123", points: 220, spending: 3450, visits: 14, color: "bg-amber-500" },
];

export const stockItems = [
  { id: 1, name: "ข้าวหอมมะลิ", unit: "กก.", quantity: 25, threshold: 10, status: "พอเพียง" },
  { id: 2, name: "เนื้อหมูสับ", unit: "กก.", quantity: 4, threshold: 5, status: "ใกล้หมด" },
  { id: 3, name: "กุ้งสด", unit: "กก.", quantity: 8, threshold: 5, status: "พอเพียง" },
  { id: 4, name: "ใบกะเพรา", unit: "กก.", quantity: 1, threshold: 2, status: "ใกล้หมด" },
  { id: 5, name: "ไข่ไก่", unit: "ฟอง", quantity: 120, threshold: 60, status: "พอเพียง" },
  { id: 6, name: "น้ำมันพืช", unit: "ลิตร", quantity: 18, threshold: 10, status: "พอเพียง" },
];

export const rewards = [
  { id: 1, name: "ส่วนลด 50 บาท", points: 100, active: true },
  { id: 2, name: "เครื่องดื่มฟรี 1 แก้ว", points: 150, active: true },
  { id: 3, name: "ของหวานฟรี 1 จาน", points: 200, active: true },
  { id: 4, name: "ส่วนลด 20%", points: 300, active: false },
];

export const hourlyRevenue = Array.from({ length: 24 }, (_, i) => {
  const peak = (h) => {
    if (h >= 11 && h <= 13) return 1.0;
    if (h >= 17 && h <= 20) return 1.2;
    if (h >= 7 && h <= 9) return 0.6;
    return 0.2;
  };
  const base = Math.round(1500 * peak(i) + Math.random() * 600);
  return { hour: `${i.toString().padStart(2, "0")}:00`, revenue: i < 6 ? 0 : base };
});

export const paymentMethods = [
  { name: "เงินสด", value: 12400, color: "#F97316" },
  { name: "QR PromptPay", value: 18900, color: "#10B981" },
  { name: "บัตรเครดิต", value: 6800, color: "#8B5CF6" },
  { name: "อื่นๆ", value: 1500, color: "#F59E0B" },
];

export const salesByCategory = [
  { category: "อาหารจานเดียว", sales: 22400 },
  { category: "ของทอด", sales: 8900 },
  { category: "เครื่องดื่ม", sales: 5600 },
  { category: "ขนมและของหวาน", sales: 3700 },
];

export const popularItems = [
  { name: "ข้าวกะเพราหมูสับ", count: 124 },
  { name: "ผัดไทยกุ้งสด", count: 98 },
  { name: "ชาไทยเย็น", count: 76 },
  { name: "ไก่ทอดน้ำปลา", count: 64 },
  { name: "ข้าวเหนียวมะม่วง", count: 41 },
];

export const dashboardStats = {
  revenue: 39600,
  orders: 142,
  avgPerOrder: 279,
  completed: 138,
  discount: 1240,
};

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { apiGet } from "../lib/api.js";
import { useNavigate } from "react-router-dom";

export default function OnboardingWizard({ onComplete }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState([
    { id: "categories", title: "สร้างหมวดหมู่เมนู", desc: "จัดกลุ่มเมนูอาหารของคุณ", done: false, path: "/admin/menu" },
    { id: "items", title: "เพิ่มเมนูอาหาร", desc: "เพิ่มรายการอาหารพร้อมราคา", done: false, path: "/admin/menu" },
    { id: "tables", title: "เพิ่มโต๊ะ", desc: "ตั้งค่าโต๊ะสำหรับรับออเดอร์", done: false, path: "/admin/tables" },
    { id: "employees", title: "เพิ่มพนักงาน", desc: "เพิ่มรายชื่อพนักงานในร้าน", done: false, path: "/admin/staff" },
    { id: "shift", title: "เปิดกะ (Open Shift)", desc: "เปิดกะการขายเพื่อเริ่มรับออเดอร์", done: false, path: "/admin/shifts" },
  ]);

  useEffect(() => {
    async function checkStatus() {
      try {
        const [cats, items, tables, emps, curShift] = await Promise.all([
          apiGet("/menu/categories"),
          apiGet("/menu/items"),
          apiGet("/tables"),
          apiGet("/employees"),
          apiGet("/shifts/current")
        ]);

        const newSteps = [...steps];
        newSteps[0].done = cats.length > 0;
        newSteps[1].done = items.length > 0;
        newSteps[2].done = tables.length > 0;
        newSteps[3].done = emps.length > 0;
        newSteps[4].done = !!curShift;

        setSteps(newSteps);
        
        // If all done, we can auto-hide or notify parent
        if (newSteps.every(s => s.done)) {
          if (onComplete) onComplete();
        }
      } catch (e) {
        console.error("Failed to check onboarding status", e);
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  if (loading) return null;
  
  if (steps.every(s => s.done)) {
    return null;
  }

  const handleGo = (path) => {
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-brand-orange px-6 py-8 text-center text-white">
          <h2 className="text-2xl font-bold">ยินดีต้อนรับสู่ FoodPOS</h2>
          <p className="mt-2 text-sm opacity-90">ร้านใหม่ของคุณพร้อมใช้งานแล้ว<br/>เพียงทำตามขั้นตอนเหล่านี้ให้ครบเพื่อเริ่มรับออเดอร์</p>
        </div>
        <div className="px-6 py-4">
          <ul className="space-y-3">
            {steps.map((s, idx) => (
              <li key={s.id} className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${s.done ? "border-green-100 bg-green-50" : "border-gray-200 bg-white"}`}>
                <div className="flex-shrink-0">
                  {s.done ? <CheckCircle2 className="text-green-500" size={28} /> : <Circle className="text-gray-300" size={28} />}
                </div>
                <div className="flex-1">
                  <h4 className={`font-bold ${s.done ? "text-green-800" : "text-gray-900"}`}>{idx + 1}. {s.title}</h4>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
                {!s.done && (
                  <button onClick={() => handleGo(s.path)} className="flex items-center justify-center rounded-full bg-orange-100 p-2 text-brand-orange hover:bg-brand-orange hover:text-white transition-colors">
                    <ArrowRight size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex justify-between items-center">
           <span className="text-xs text-gray-500">คุณสามารถปิดหน้าต่างนี้ได้ถ้าต้องการข้ามขั้นตอน</span>
           <button onClick={() => { if (onComplete) onComplete() }} className="text-sm font-semibold text-gray-500 hover:text-gray-800">ข้ามไปก่อน</button>
        </div>
      </div>
    </div>
  );
}

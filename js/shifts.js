import { supabase } from "./supabase.js";

export async function addShift(data) {
  const start = new Date(`1970-01-01T${data.start_time}`);
  const end = new Date(`1970-01-01T${data.end_time}`);
  const minutes = (end - start) / 60000;

  return supabase.from("shifts").insert({
    shift_date: data.shift_date,
    start_time: data.start_time,
    end_time: data.end_time,
    minutes_total: minutes,
    note: data.note || null
  });
}

export async function getShifts(from, to) {
  return supabase
    .from("shifts")
    .select("*")
    .gte("shift_date", from)
    .lte("shift_date", to)
    .order("shift_date", { ascending: false });
}

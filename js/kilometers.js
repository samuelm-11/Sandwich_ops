import { supabase } from "./supabase.js";

export async function addKilometers(data) {
  const total = data.km_end - data.km_start;
  const reimbursement = total * data.rate_cents;

  return supabase.from("kilometers").insert({
    km_date: data.km_date,
    km_start: data.km_start,
    km_end: data.km_end,
    km_total: total,
    rate_cents: data.rate_cents,
    reimbursement_cents: reimbursement
  });
}

export async function getKilometers(from, to) {
  return supabase
    .from("kilometers")
    .select("*")
    .gte("km_date", from)
    .lte("km_date", to)
    .order("km_date", { ascending: false });
}

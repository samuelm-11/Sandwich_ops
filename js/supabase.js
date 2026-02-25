import { createClient } from “https://esm.sh/@supabase/supabase-js@2”;

export const SUPABASE_URL = “https://frbofmnvfvzrtefwhdyo.supabase.co”;
export const SUPABASE_ANON_KEY = “eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYm9mbW52ZnZ6cnRlZndoZHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzAxNzMsImV4cCI6MjA4NzAwNjE3M30.LgDTq7ncaclByUYi3FYr6LwFBpUFIbamKixmkv2U7HU”;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 

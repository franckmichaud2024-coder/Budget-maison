import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ouvybtnapkoeqfwnrnlr.supabase.co";
const supabaseKey = "sb_publishable_Kpjr5LD1wtbIsKaVHS2h1Q_OIYF5v5u";

export const supabase = createClient(supabaseUrl, supabaseKey);
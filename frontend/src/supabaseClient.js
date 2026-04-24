import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ezhemldtdtmdzgczgxjq.supabase.co";
const supabaseAnonKey = "sb_publishable_mdjw5QLqmFTczD7vvAs8Wg_4JhNlmYI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
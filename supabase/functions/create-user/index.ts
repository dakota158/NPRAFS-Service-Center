import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(
        { error: "Missing Supabase environment variables" },
        500,
        corsHeaders
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const adminClient = createClient(supabaseUrl, serviceKey);

    const {
      data: { user: caller },
      error: callerError
    } = await userClient.auth.getUser();

    if (callerError || !caller) {
      return json({ error: "Invalid caller" }, 401, corsHeaders);
    }

    const { data: callerProfile, error: callerProfileError } =
      await adminClient
        .from("profiles")
        .select("role")
        .eq("id", caller.id)
        .single();

    if (callerProfileError || !callerProfile) {
      return json({ error: "Caller profile not found" }, 403, corsHeaders);
    }

    const body = await req.json();

    const {
      email,
      password,
      name,
      phone,
      position,
      role
    } = body;

    if (!email || !password || !name || !phone || !position || !role) {
      return json(
        { error: "Name, email, phone, position, password, and role are required" },
        400,
        corsHeaders
      );
    }

    const allowedRoles = ["Tech", "Manager", "IT", "admin"];

    if (!allowedRoles.includes(role)) {
      return json({ error: "Invalid role" }, 400, corsHeaders);
    }

    const callerRole = callerProfile.role;

    if (callerRole === "Manager" && role !== "Tech") {
      return json(
        { error: "Managers can only create Tech users" },
        403,
        corsHeaders
      );
    }

    if (callerRole === "IT" && role === "admin") {
      return json(
        { error: "Only admin accounts can create admin users" },
        403,
        corsHeaders
      );
    }

    if (!["admin", "IT", "Manager"].includes(callerRole)) {
      return json(
        { error: "You are not allowed to create users" },
        403,
        corsHeaders
      );
    }

    const { data: createdUser, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          phone,
          position,
          role
        }
      });

    if (createUserError || !createdUser.user) {
      return json(
        { error: createUserError?.message || "Failed to create user" },
        400,
        corsHeaders
      );
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: createdUser.user.id,
      email,
      name,
      phone,
      position,
      role
    });

    if (profileError) {
      return json({ error: profileError.message }, 400, corsHeaders);
    }

    return json(
      {
        success: true,
        user: {
          id: createdUser.user.id,
          email,
          name,
          phone,
          position,
          role
        }
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return json(
      { error: String(err?.message || err) },
      500,
      {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    );
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json"
    }
  });
}
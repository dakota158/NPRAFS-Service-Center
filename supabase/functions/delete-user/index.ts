import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { userId, requesterId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!requesterId) {
      return new Response(
        JSON.stringify({ error: "Missing requesterId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (userId === requesterId) {
      return new Response(
        JSON.stringify({ error: "You cannot delete your own account while logged in." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: requesterProfile, error: requesterError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", requesterId)
      .maybeSingle();

    if (requesterError || !requesterProfile) {
      return new Response(
        JSON.stringify({ error: "Could not verify requester permissions." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, email")
      .eq("id", userId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "Target user profile not found." }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const requesterRole = requesterProfile.role;
    const targetRole = targetProfile.role;

    let allowed = false;

    if (requesterRole === "admin" || requesterRole === "Admin") {
      allowed = true;
    }

    if (requesterRole === "IT") {
      allowed = targetRole === "IT" || targetRole === "Manager" || targetRole === "Tech";
    }

    if (requesterRole === "Manager") {
      allowed = targetRole === "Tech";
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "You are not allowed to delete that user type." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      return new Response(
        JSON.stringify({ error: authDeleteError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) {
      return new Response(
        JSON.stringify({ error: profileDeleteError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
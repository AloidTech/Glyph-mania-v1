import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

// Interfaces to match our expected payload
interface CreateSigilRequest {
  id?: string;
  label: string;
  description: string;
  tier: number;
  cover_asset?: string;
  svg_path?: string;
  texture_key: string;
  type: 'effector' | 'augmentor';
  element?: string;
  augmentor_type?: 'position' | 'form';
  form_type?: string;
  coverImageBase64?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Authenticate the User
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Optional: Validate if the user is an Admin
    // const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
    // if (profile?.role !== 'admin') throw new Error("Only admins can create sigils.");

    // 2. Parse Request
    const payload = await req.json() as CreateSigilRequest;
    
    // 3. Validation Logic
    if (!payload.label || !payload.type) {
      throw new Error("Label and type are required.");
    }

    // Ensure the payload strictly adheres to the Discriminated Union rules
    if (payload.type === 'effector') {
      if (!payload.element) throw new Error("Effectors must have an element.");
      payload.augmentor_type = undefined;
      payload.form_type = undefined;
    } else if (payload.type === 'augmentor') {
      if (!payload.augmentor_type) throw new Error("Augmentors must specify an augmentor_type (position or form).");
      payload.element = undefined;
      if (payload.augmentor_type === 'position') {
        payload.form_type = undefined;
      }
    }

    // 4. Insert or Upsert into Database
    const cleanLabel = (payload.label || 'sigil').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const prefix = payload.type === 'effector' ? 'eff' : payload.type === 'augmentor' ? 'aug' : 'sigil';
    const fallbackId = `${prefix}-${cleanLabel}-${Date.now().toString(36).slice(-4)}`;
    const sigilId = payload.id || fallbackId;

    let coverAsset = payload.cover_asset || payload.svg_path || '/sigils/svg/eff-fire.svg';
    if (payload.coverImageBase64) {
      try {
        const base64Data = payload.coverImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBytes = decode(base64Data);
        
        const filePath = `sigils/${sigilId}.png`;
        
        const { error: uploadError } = await supabaseClient.storage
          .from('assets')
          .upload(filePath, imageBytes, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error("Failed to upload sigil cover:", uploadError);
        } else {
          const { data: publicUrlData } = supabaseClient.storage
            .from('assets')
            .getPublicUrl(filePath);
          coverAsset = publicUrlData.publicUrl;
        }
      } catch (err) {
        console.error("Failed to decode/upload sigil cover:", err);
      }
    }

    const sigilRecord: any = {
      id: sigilId,
      label: payload.label,
      description: payload.description,
      tier: payload.tier,
      cover_asset: coverAsset,
      texture_key: payload.texture_key,
      type: payload.type,
      element: payload.element,
      augmentor_type: payload.augmentor_type,
      form_type: payload.form_type,
    };

    const { data: newSigil, error: saveError } = await supabaseClient
      .from('sigils')
      .upsert([sigilRecord], { onConflict: 'id' })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(JSON.stringify({ data: newSigil }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error creating sigil:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

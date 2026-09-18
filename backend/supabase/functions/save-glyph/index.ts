import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { isSolid } from '../_shared/glyph_logic.ts';

// Interfaces to match our expected payload
interface SaveGlyphRequest {
  name: string;
  description: string;
  element: string;
  tier: number;
  isPublic: boolean;
  composition: any;
  coverImageBase64?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase Admin Client
    // We use the service role key to bypass RLS, but we strictly validate the user via their JWT.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Authenticate the User
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: userError ? userError.message : 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Parse and Validate the Request Payload
    const payload = await req.json() as SaveGlyphRequest;

    if (!payload.name || !payload.composition) {
      return new Response(JSON.stringify({ error: 'Invalid payload: Missing name or composition' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- GAME LOGIC VALIDATION GOES HERE ---
    // 1. Fetch sigils to resolve types (effector vs augmentor, formType, etc.)
    const { data: sigilsData, error: sigilsError } = await supabaseClient
      .from('sigils')
      .select('id, type, augmentor_type, form_type, element');

    if (sigilsError) {
      throw new Error(`Failed to load sigils for validation: ${sigilsError.message}`);
    }
    // Map database snake_case columns to the format isSolid expects
    const sigilLookup = (sigilsData || []).reduce((acc: any, s: any) => {
      acc[s.id] = {
        id: s.id,
        type: s.type,
        augmentorType: s.augmentor_type,
        formType: s.form_type,
        element: s.element,
      };
      return acc;
    }, {});
    // 2. Run the solidity analysis
    const solidity = isSolid(
      { id: 'temp', tier: payload.tier, composition: payload.composition } as any,
      sigilLookup
    );
    
    // Only enforce solidity if the user is trying to make the glyph public
    if (payload.isPublic && !solidity.isSolid) {
      return new Response(
        JSON.stringify({
          error: 'Glyph composition must be solid to be saved publicly. Please ensure all symbols are correctly drawn and valid.',
          reasons: solidity.reasons,
          slotErrors: solidity.slotErrors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    const { data: tierData, error: tierError } = await supabaseClient
      .from('tiers')
      .select('id')
      .eq('level', payload.tier)
      .single();

    if (tierError || !tierData) {
      return new Response(JSON.stringify({ error: 'Invalid tier level specified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Generate UUID for the new glyph to use as filename
    const newGlyphId = crypto.randomUUID();

    let coverAssetUrl = null;
    if (payload.coverImageBase64) {
      try {
        // Remove the data URI prefix if it exists (e.g. "data:image/png;base64,")
        const base64Data = payload.coverImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBytes = decode(base64Data);
        
        const filePath = `glyphs/${user.id}/${newGlyphId}.png`;
        
        const { error: uploadError } = await supabaseClient.storage
          .from('assets')
          .upload(filePath, imageBytes, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error("Failed to upload glyph cover:", uploadError);
        } else {
          const { data: publicUrlData } = supabaseClient.storage
            .from('assets')
            .getPublicUrl(filePath);
          coverAssetUrl = publicUrlData.publicUrl;
        }
      } catch (err) {
        console.error("Failed to decode/upload glyph cover:", err);
      }
    }

    // 6. Insert the new Glyph securely
    // (Note: Schema might need to be updated to store is_public, description, element)
    const { data: newGlyph, error: insertError } = await supabaseClient
      .from('glyphs')
      .insert([
        {
          id: newGlyphId,
          user_id: user.id,
          name: payload.name,
          tier_id: tierData.id,
          composition: payload.composition,
          description: payload.description,
          element: payload.element,
          is_public: payload.isPublic,
          cover_asset: coverAssetUrl,
        }
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({ data: newGlyph }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in save-glyph function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

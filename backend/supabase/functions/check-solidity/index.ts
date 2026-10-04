import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";
import { analyzeSolidity } from '../_shared/glyph_logic.ts';

interface CheckSolidityRequest {
  tier?: number;
  composition: any;
  element?: string;
  accuracies?: Record<string, number>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Parse request
    let payload: CheckSolidityRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payload.composition) {
      return new Response(JSON.stringify({ error: 'Missing required field: composition' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch live sigils catalog from database
    const { data: sigilsData, error: sigilsError } = await supabaseClient
      .from('sigils')
      .select('id, label, type, augmentor_type, form_type, element');

    if (sigilsError) {
      throw new Error(`Failed to load sigils from database: ${sigilsError.message}`);
    }

    // 2. Build sigils lookup map
    const sigilLookup = (sigilsData || []).reduce((acc: any, s: any) => {
      acc[s.id] = {
        id: s.id,
        label: s.label,
        type: s.type,
        augmentorType: s.augmentor_type,
        formType: s.form_type,
        element: s.element,
      };
      return acc;
    }, {});

    // 3. Run solidity validation
    const glyphData = {
      id: 'backend-solidity-check',
      tier: payload.tier || 1,
      element: payload.element,
      composition: payload.composition,
    };

    const analysis = analyzeSolidity(glyphData as any, sigilLookup, payload.accuracies);

    return new Response(JSON.stringify({ data: analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in check-solidity function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal solidity analysis error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

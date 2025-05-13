import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Goog-Channel-ID, X-Goog-Resource-ID, X-Goog-Resource-State, X-Goog-Channel-Expiration, X-Goog-Channel-Token, X-Goog-Message-Number',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Get webhook headers
    const channelId = req.headers.get('X-Goog-Channel-ID');
    const resourceState = req.headers.get('X-Goog-Resource-State');

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'Missing channel ID' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the user associated with this webhook
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('webhook_channel_id', channelId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For now, just acknowledge the webhook
    const response = {
      success: true,
      userId: userData.id,
      channelId,
      resourceState,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
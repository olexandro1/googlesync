import { supabase } from './supabase';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar'
].join(' ');

export async function initializeGoogleCalendar(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API client'));
      document.head.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

export async function signInWithGoogle(): Promise<void> {
  try {
    // Check if we have a hash in the URL (OAuth callback)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    if (accessToken) {
      // We're in the OAuth callback, handle the token
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError || new Error('No user found');

      // Check if user exists in our database and get their role
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw userError;
      }

      // If user doesn't exist in our database, create them with appropriate role
      if (!existingUser) {
        // Check if this is the admin email
        const isAdmin = user.email === 'admin@example.com';
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            role: isAdmin ? 'admin' : 'user',
            name: user.user_metadata.name
          });

        if (insertError) throw insertError;
      }

      // Clear the hash from the URL
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // If no access token in URL, initiate OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: SCOPES,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        },
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    window.location.href = data.url;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred');
  }
}

export async function fetchAndStoreEvents(): Promise<void> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('No active session found');
    }

    const { provider_token, user } = session;
    
    if (!provider_token) {
      throw new Error('No valid Google token found. Please sign in again.');
    }

    if (!user?.email) {
      throw new Error('User email not found');
    }

    // Set up webhook for real-time updates
    await setupCalendarWebhook('primary', provider_token);

    // Calculate time range (1 month ago to 1 year ahead)
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 1);

    // Fetch events from Google Calendar
    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` + 
      new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: '100',
        orderBy: 'startTime',
        singleEvents: 'true',
      }),
      {
        headers: {
          'Authorization': `Bearer ${provider_token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!eventsResponse.ok) {
      const errorData = await eventsResponse.json();
      throw new Error(`Failed to fetch calendar events: ${errorData.error?.message || eventsResponse.statusText}`);
    }

    const data = await eventsResponse.json();

    // Delete existing events for this user
    await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', user.id);

    // Store new events
    for (const event of data.items) {
      if (!event.start?.dateTime && !event.start?.date) continue;
      
      await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          email: user.email,
          title: event.summary || 'Untitled Event',
          start_time: event.start.dateTime || `${event.start.date}T00:00:00Z`,
          end_time: event.end.dateTime || `${event.end.date}T23:59:59Z`,
        });
    }
  } catch (error) {
    console.error('Error in fetchAndStoreEvents:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred');
  }
}

async function setupCalendarWebhook(calendarId: string, accessToken: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // Check if there's an existing webhook that hasn't expired
    const { data: userData } = await supabase
      .from('users')
      .select('webhook_channel_id, webhook_expiry')
      .eq('id', user.id)
      .single();

    if (userData?.webhook_expiry && new Date(userData.webhook_expiry) > new Date()) {
      console.log('Webhook already active');
      return;
    }

    // If webhook exists but expired, stop it first
    if (userData?.webhook_channel_id) {
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/channels/stop`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: userData.webhook_channel_id,
            resourceId: calendarId
          })
        });
      } catch (error) {
        console.error('Error stopping existing webhook:', error);
      }
    }

    // Create new webhook
    const channelId = crypto.randomUUID();
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-webhook`;
    const expirationTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: expirationTime.getTime().toString(),
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to set up webhook: ${error.error?.message || response.statusText}`);
    }

    // Store webhook details
    await supabase
      .from('users')
      .update({
        calendar_id: calendarId,
        webhook_channel_id: channelId,
        webhook_expiry: expirationTime.toISOString()
      })
      .eq('id', user.id);

    console.log('Webhook setup successful');
  } catch (error) {
    console.error('Error setting up webhook:', error);
    throw error;
  }
}
import React, { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, parseISO, addHours, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Calendar, Loader2, RefreshCw, Clock, Shield, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { initializeGoogleCalendar, signInWithGoogle, fetchAndStoreEvents } from './lib/googleCalendar';
import { supabase } from './lib/supabase';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  email: string;
  user_name?: string | null;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
}

function DayView({ date, events, onClose }: { date: Date; events: CalendarEvent[]; onClose: () => void }) {
  // Generate time slots for 24 hours (12 AM to 11 PM)
  const timeSlots = Array.from({ length: 24 }, (_, i) => addHours(startOfDay(date), i));
  
  const dayEvents = events.filter(event => {
    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    return isWithinInterval(start, { start: startOfDay(date), end: endOfDay(date) });
  });

  // Group events by user
  const userEvents = dayEvents.reduce((acc, event) => {
    const userKey = event.email;
    if (!acc[userKey]) {
      acc[userKey] = {
        email: event.email,
        name: event.user_name,
        events: []
      };
    }
    acc[userKey].events.push(event);
    return acc;
  }, {} as Record<string, { email: string; name: string | null | undefined; events: CalendarEvent[] }>);

  const users = Object.values(userEvents);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
          <h2 className="text-xl font-semibold">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="min-w-max p-4">
            <div className="flex">
              {/* Time column */}
              <div className="w-20 flex-shrink-0">
                <div className="h-16 border-b border-gray-200" /> {/* Header spacer */}
                {timeSlots.map((time) => (
                  <div key={time.toISOString()} className="h-16 relative border-b border-gray-100">
                    <div className="absolute -top-3 right-2 text-sm text-gray-500">
                      {format(time, 'h:mm a')}
                    </div>
                  </div>
                ))}
              </div>

              {/* User columns */}
              {users.map(({ email, name, events }) => (
                <div key={email} className="w-64 border-l">
                  <div className="h-16 p-2 border-b border-gray-200 sticky top-0 bg-gray-50">
                    <div className="font-medium text-gray-900 truncate">
                      {name || email}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {name ? email : ''}
                    </div>
                  </div>
                  <div className="relative">
                    {timeSlots.map((time) => (
                      <div key={time.toISOString()} className="h-16 border-b border-gray-100" />
                    ))}
                    {events.map(event => {
                      const start = parseISO(event.start_time);
                      const end = parseISO(event.end_time);
                      const startHours = start.getHours() + (start.getMinutes() / 60);
                      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      
                      return (
                        <div
                          key={event.id}
                          className="absolute left-0 right-2 mx-1 bg-accent-100 border border-accent-200 rounded p-2 overflow-hidden"
                          style={{
                            top: `${startHours * 64}px`, // Remove the +64 offset
                            height: `${durationHours * 64}px`,
                          }}
                        >
                          <div className="font-medium text-accent-900 truncate">
                            {event.title}
                          </div>
                          <div className="text-sm text-accent-700">
                            {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCalendarView({ events }: { events: CalendarEvent[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (date: Date) => {
    return events.filter(event => 
      isSameDay(parseISO(event.start_time), date)
    );
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {daysInMonth.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hasEvents = dayEvents.length > 0;

            return (
              <button
                key={day.toISOString()}
                onClick={() => hasEvents && setSelectedDate(day)}
                className={`min-h-[120px] p-2 border rounded-lg transition-colors ${
                  isCurrentMonth 
                    ? 'hover:bg-gray-50 bg-white' 
                    : 'bg-gray-50 text-gray-400'
                } ${hasEvents ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`text-sm font-medium mb-2 ${
                  isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {format(day, 'd')}
                </div>
                {hasEvents && (
                  <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-accent-100 text-accent-800">
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <DayView
          date={selectedDate}
          events={events}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}

function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <Calendar className="w-16 h-16 mx-auto mb-6 text-accent-500" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar Events</h1>
        <p className="text-gray-600 mb-8">Sign in to view and manage calendar events</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-accent-500 text-white rounded-lg px-6 py-3 font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Calendar className="w-5 h-5" />
          )}
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function CalendarScreen({ user }: { user: User }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      if (user.role === 'user') {
        await fetchAndStoreEvents();
      }

      const query = user.role === 'admin' 
        ? supabase
            .from('calendar_events')
            .select(`
              *,
              users (
                name
              )
            `)
            .order('start_time', { ascending: true })
        : supabase
            .from('calendar_events')
            .select('*')
            .order('start_time', { ascending: true });

      const { data, error: eventsError } = await query;

      if (eventsError) throw eventsError;
      
      const processedEvents = data?.map(event => ({
        ...event,
        user_name: event.users?.name || null
      })) || [];

      setEvents(processedEvents);
    } catch (err) {
      console.error(err);
      setError('Failed to load events. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {user.role === 'admin' ? (
              <Shield className="w-8 h-8 text-purple-600" />
            ) : (
              <Calendar className="w-8 h-8 text-accent-500" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Calendar Events</h1>
              <p className="text-sm text-gray-600">
                {user.role === 'admin' ? 'Admin Dashboard' : `Welcome, ${user.name || user.email}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadEvents}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {user.role === 'admin' ? (
          <AdminCalendarView events={events} />
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {events.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading events...
                  </div>
                ) : (
                  'No events found.'
                )}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {events.map((event) => (
                  <li key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {event.title}
                        </h3>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(event.start_time), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(event.start_time), 'h:mm a')} -{' '}
                          {format(new Date(event.end_time), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeGoogleCalendar()
      .catch((err) => {
        console.error(err);
        setError('Failed to initialize Google Calendar. Please refresh the page and try again.');
      })
      .finally(() => setInitializing(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Fetch user role from the database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          console.error('Error fetching user role:', userError);
          setError('Failed to fetch user role');
          return;
        }

        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata.name,
          role: userData?.role || 'user'
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent-500" />
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-md w-full">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return user ? <CalendarScreen user={user} /> : <SignInScreen />;
}
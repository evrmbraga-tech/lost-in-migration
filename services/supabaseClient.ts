
import { createClient } from '@supabase/supabase-js';

// Your Project URL
const supabaseUrl = 'https://thxxooxgfmxpiecmsjue.supabase.co';
// Your Publishable (Anon) Key
const supabaseAnonKey = 'sb_publishable_bDyK4HiuvfJVbgj-sUHX4Q_5mQFh5kE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Checks if the connection to the 'rankings' table is working.
 */
export async function checkConnection() {
  try {
    const { data, error } = await supabase.from('rankings').select('id').limit(1);
    if (error) {
      console.error('Supabase Connection Error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase Connection Exception:', err);
    return false;
  }
}

/**
 * Fetches the top 5 scores from the global leaderboard.
 */
export async function getGlobalLeaderboard() {
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('*')
      .order('score', { ascending: false })
      .order('accuracy', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Supabase Fetch Error:', error.message);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Supabase Fetch Exception:', error);
    return null;
  }
}

/**
 * Saves a new game result to the 'rankings' table.
 */
export async function saveRanking(ranking: { score: number, correct: number, accuracy: number, max_streak: number }) {
  try {
    // We send snake_case to match typical Supabase table naming conventions
    const { data, error } = await supabase
      .from('rankings')
      .insert([ranking])
      .select();

    if (error) {
      console.error('Supabase Save Error:', error.message);
      console.error('Check your RLS policies for the "rankings" table. You need to allow "INSERT" for anonymous users.');
      return null;
    }
    
    console.log('Successfully saved to Supabase:', data[0]);
    return data[0];
  } catch (error) {
    console.error('Supabase Save Exception:', error);
    return null;
  }
}

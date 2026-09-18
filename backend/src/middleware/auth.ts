import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

// Extend the Express Request to include our user object
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Initialize Supabase client for the backend
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_PUBLIC_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Verify the JWT token using Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ success: false, error: 'Invalid or expired token', details: error?.message });
    return;
  }

  // Attach the user to the request object so routes can use it (e.g., req.user.id)
  req.user = user;
  
  next();
};

/**
 * Checks if the given email belongs to an administrator.
 * Expects a comma-separated list of emails in the ADMIN_EMAILS environment variable.
 */
export const isAdminEmail = (email: string): boolean => {
  if (!email) return false;
  
  const adminEmailsString = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsString.split(',').map(e => e.trim().toLowerCase());
  
  return adminEmails.includes(email.trim().toLowerCase());
};

// src/lib/supabase/repos/auth.repo.ts
import { supabase } from '../../supabase';

export type SignUpParams = {
  email: string;
  password: string;
  displayName?: string;
};

export type SignInParams = {
  email: string;
  password: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function toUserMessage(err: unknown, fallback = '發生錯誤，請稍後再試') {
  const msg = (err as any)?.message ?? '';
  if (!msg) return fallback;

  // 你可以在這裡做更完整的 supabase error mapping
  if (msg.toLowerCase().includes('invalid login credentials')) return '帳號或密碼錯誤';
  if (msg.toLowerCase().includes('password should be at least')) return '密碼太短（至少 6 碼）';
  if (msg.toLowerCase().includes('user already registered')) return '此 Email 已被註冊';
  if (msg.toLowerCase().includes('email')) return msg; // 先保留原始訊息
  return msg;
}

export async function signUpWithEmail(params: SignUpParams) {
  const email = normalizeEmail(params.email);

  const { data, error } = await supabase.auth.signUp({
    email,
    password: params.password,
    options: {
      // ✅ 讓 trigger handle_new_user() 讀到 raw_user_meta_data.display_name
      data: params.displayName ? { display_name: params.displayName } : undefined,
    },
  });

  if (error) throw error;

  // 注意：如果你的 Supabase 專案有開啟 email confirmation，
  // 這裡 data.session 可能是 null，需要使用者去信箱點確認
  return data;
}

export async function signInWithEmail(params: SignInParams) {
  const email = normalizeEmail(params.email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: params.password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

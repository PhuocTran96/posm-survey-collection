import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      userid: string;
      username: string;
      loginid: string;
      role: string;
      leader: string | null;
      isSuperAdmin: boolean;
    };
  }

  interface User {
    id: string;
    userid: string;
    username: string;
    loginid: string;
    role: string;
    leader: string | null;
    isSuperAdmin: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    userid: string;
    username: string;
    loginid: string;
    role: string;
    leader: string | null;
    isSuperAdmin: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        loginid: { label: 'Login ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('Authorize called with loginid:', credentials?.loginid);
        
        if (!credentials?.loginid || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        try {
          const user = await db.user.findUnique({
            where: { loginid: credentials.loginid },
          });

          console.log('User found:', user ? user.loginid : 'not found');

          if (!user || !user.isActive) {
            console.log('User not found or inactive');
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          console.log('Password valid:', isPasswordValid);

          if (!isPasswordValid) {
            return null;
          }

          // Update last login
          await db.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });

          console.log('Authorization successful for:', user.username);

          return {
            id: user.id,
            userid: user.userid,
            username: user.username,
            loginid: user.loginid,
            role: user.role,
            leader: user.leader,
            isSuperAdmin: user.isSuperAdmin,
          };
        } catch (error) {
          console.error('Authorization error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      console.log('JWT callback - user:', user ? 'exists' : 'null', 'trigger:', trigger);
      
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.userid = user.userid;
        token.username = user.username;
        token.loginid = user.loginid;
        token.role = user.role;
        token.leader = user.leader;
        token.isSuperAdmin = user.isSuperAdmin;
      }
      
      // Update session
      if (trigger === 'update' && session) {
        token = { ...token, ...session };
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log('Session callback - token:', token ? 'exists' : 'null');
      
      if (token) {
        session.user = {
          id: token.id as string,
          userid: token.userid as string,
          username: token.username as string,
          loginid: token.loginid as string,
          role: token.role as string,
          leader: token.leader as string | null,
          isSuperAdmin: token.isSuperAdmin as boolean,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || 'posm-survey-secret-key-2024',
  debug: true,
};

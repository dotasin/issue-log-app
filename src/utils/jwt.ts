// src/utils/jwt.ts

import jwt, { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '../types';
import { AuthenticationError } from './errorTypes';

type ExpiryString = `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`; // e.g., '15m', '24h'

export class JWTUtils {
  private static accessTokenSecret: string = process.env.JWT_SECRET ?? 'fallback-secret';
  private static refreshTokenSecret: string = process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret';
  private static accessTokenExpiry: ExpiryString = (process.env.JWT_EXPIRES_IN ?? '24h') as ExpiryString;
  private static refreshTokenExpiry: ExpiryString = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as ExpiryString;

  public static generateAccessToken(payload: JwtPayload): string {
    const options: SignOptions = { expiresIn: this.accessTokenExpiry };
    return jwt.sign(payload, this.accessTokenSecret, options);
  }

  public static generateRefreshToken(payload: JwtPayload): string {
    const options: SignOptions = { expiresIn: this.refreshTokenExpiry };
    return jwt.sign(payload, this.refreshTokenSecret, options);
  }

  /**
   * Generate both access and refresh tokens
   */
  public static generateTokens(payload: JwtPayload): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify access token
   */
  public static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    } catch {
      throw new AuthenticationError('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  public static verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as JwtPayload;
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  public static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  public static isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  }

  /**
   * Extract token from Authorization header
   */
  public static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

    return parts[1];
  }

  /**
   * Get token expiration time
   */
  public static getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return null;

    return new Date(decoded.exp * 1000);
  }
}

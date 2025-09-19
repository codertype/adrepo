import { Request, Response, NextFunction } from "express";

export interface RequestWithSource extends Request {
  source?: {
    type: 'web' | 'mobile' | 'unknown';
    platform?: 'android' | 'ios' | 'web';
    appVersion?: string;
    userAgent: string;
    isNativeApp: boolean;
  };
}

// Middleware to detect request source
export function detectRequestSource(req: RequestWithSource, res: Response, next: NextFunction) {
  const userAgent = req.get('User-Agent') || '';
  const xRequestedWith = req.get('X-Requested-With') || '';
  const customAppHeader = req.get('X-App-Source') || '';
  const appVersion = req.get('X-App-Version') || '';
  
  let sourceType: 'web' | 'mobile' | 'unknown' = 'unknown';
  let platform: 'android' | 'ios' | 'web' | undefined;
  let isNativeApp = false;

  // Check for custom app headers (recommended approach)
  if (customAppHeader) {
    if (customAppHeader.toLowerCase().includes('amritdairy-mobile') || 
        customAppHeader.toLowerCase().includes('amritdairy-milkmanager')) {
      sourceType = 'mobile';
      isNativeApp = true;
      
      if (customAppHeader.toLowerCase().includes('android')) {
        platform = 'android';
      } else if (customAppHeader.toLowerCase().includes('ios')) {
        platform = 'ios';
      }
    }
  }
  
  // Check for React Native specific patterns
  else if (userAgent.includes('React Native') || 
           userAgent.includes('Expo') ||
           userAgent.includes('MilkManager') ||
           userAgent.includes('NativeMobile')) {
    sourceType = 'mobile';
    isNativeApp = true;
    
    if (userAgent.toLowerCase().includes('android')) {
      platform = 'android';
    } else if (userAgent.toLowerCase().includes('ios')) {
      platform = 'ios';
    }
  }
  
  // Check for Flutter app patterns
  else if (userAgent.includes('Flutter') || 
           userAgent.includes('Dart')) {
    sourceType = 'mobile';
    isNativeApp = true;
    
    if (userAgent.toLowerCase().includes('android')) {
      platform = 'android';
    } else if (userAgent.toLowerCase().includes('ios')) {
      platform = 'ios';
    }
  }
  
  // Check for mobile browsers
  else if (userAgent.includes('Mobile') || 
           userAgent.includes('Android') || 
           userAgent.includes('iPhone') || 
           userAgent.includes('iPad')) {
    sourceType = 'mobile';
    platform = userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'ios' : 'android';
  }
  
  // Default to web for desktop browsers
  else if (userAgent.includes('Mozilla') || 
           userAgent.includes('Chrome') || 
           userAgent.includes('Safari') || 
           userAgent.includes('Firefox')) {
    sourceType = 'web';
    platform = 'web';
  }

  // Attach source information to request
  req.source = {
    type: sourceType,
    platform,
    appVersion,
    userAgent,
    isNativeApp
  };

  // Log request source for monitoring
  console.log(`📱 Request from ${sourceType}${platform ? ` (${platform})` : ''}: ${req.method} ${req.path}`);
  
  next();
}

// Helper function to check if request is from mobile app
export function isMobileApp(req: RequestWithSource): boolean {
  return req.source?.isNativeApp === true;
}

// Helper function to check if request is from web
export function isWebRequest(req: RequestWithSource): boolean {
  return req.source?.type === 'web';
}

// Helper function to get platform
export function getPlatform(req: RequestWithSource): string {
  return req.source?.platform || 'unknown';
}
export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface Report {
  id: number;
  user_id: string;
  user_name?: string;
  type: 'accident' | 'pothole' | 'construction' | 'weather' | 'other';
  description: string;
  latitude: number;
  longitude: number;
  image_url: string;
  is_ai_generated: boolean;
  status: 'pending' | 'verified' | 'resolved';
  created_at: string;
}

export interface SafetyAlert {
  title: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

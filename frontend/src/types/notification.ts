export type NotificationType = 'export_completed' | 'export_failed';

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  entity_id: number | null;
};

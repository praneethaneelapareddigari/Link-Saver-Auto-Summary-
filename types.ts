export type Bookmark = {
  id: string;
  user_id: string;
  url: string;
  title?: string | null;
  favicon?: string | null;
  summary?: string | null;
  tags?: string[] | null;  
  created_at?: string;
};

export type Bookmark = {
  id: string;
  url: string;
  title: string | null;
  favicon: string | null;
  tags: string[] | null;
  created_at: string;
  summary: string | null;                
  summary_fetched_at: string | null;     
};

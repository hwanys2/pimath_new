import type { ForumCategoryId } from "@/lib/forum/catalog";

export type { ForumCategoryId };

export type ForumStoredImage = {
  path: string;
  url: string;
};

export type ForumPostSummary = {
  id: string;
  category: ForumCategoryId;
  title: string;
  bodyPreview: string;
  authorName: string;
  isAuthor: boolean;
  isAdminAuthor: boolean;
  commentCount: number;
  imageCount: number;
  createdAt: string;
};

export type ForumPostDetail = {
  id: string;
  category: ForumCategoryId;
  title: string;
  body: string;
  images: ForumStoredImage[];
  authorName: string;
  isAuthor: boolean;
  isAdminAuthor: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ForumComment = {
  id: string;
  body: string;
  images: ForumStoredImage[];
  authorName: string;
  isAuthor: boolean;
  isAdminAuthor: boolean;
  createdAt: string;
};

export type ForumPostList = {
  posts: ForumPostSummary[];
  totalCount: number;
};

import React from 'react';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Code,
  File,
} from 'lucide-react';

export const FileIcon = ({ category, size = 20 }) => {
  switch (category) {
    case 'folder':
      return <Folder size={size} color="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />;
    case 'pdf':
      return <FileText size={size} color="#f43f5e" />;
    case 'document':
      return <FileText size={size} color="#38bdf8" />;
    case 'image':
      return <ImageIcon size={size} color="#a855f7" />;
    case 'video':
      return <Video size={size} color="#6366f1" />;
    case 'audio':
      return <Music size={size} color="#ec4899" />;
    case 'archive':
      return <Archive size={size} color="#f59e0b" />;
    case 'code':
      return <Code size={size} color="#10b981" />;
    default:
      return <File size={size} color="#94a3b8" />;
  }
};

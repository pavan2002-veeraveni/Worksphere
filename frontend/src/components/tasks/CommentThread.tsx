'use client';

import React, { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useCreateComment, useTaskComments } from '@/hooks/useTasks';
import { formatRelative } from '@/lib/utils';

export function CommentThread({ taskId }: { taskId: string }) {
  const [content, setContent] = useState('');
  const { data: comments = [], isLoading } = useTaskComments(taskId);
  const { mutateAsync: addComment, isPending } = useCreateComment(taskId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await addComment({ content: content.trim() });
    setContent('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-secondary-500">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-secondary-500">No comments yet. Start the discussion.</p>
        ) : (
          comments.map((c) => {
            const name =
              c.first_name || c.author?.firstName
                ? `${c.first_name || c.author?.firstName} ${c.last_name || c.author?.lastName}`
                : 'Team Member';
            const created = c.created_at || c.createdAt;
            return (
              <div key={c.id} className="flex gap-3 rounded-lg border border-secondary-100 bg-secondary-50 p-3">
                <Avatar name={name} size="sm" />
                <div className="flex-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-secondary-900">{name}</span>
                    {created && <span className="text-xs text-secondary-400">{formatRelative(created)}</span>}
                  </div>
                  <p className="mt-1 text-secondary-700">{c.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <Button type="submit" size="sm" loading={isPending}>
          Post
        </Button>
      </form>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useSelector } from 'react-redux';
import { InviteMemberForm, InviteMemberValues } from '@/components/forms/InviteMemberForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { get, post } from '@/lib/api';
import type { RootState } from '@/store/store';
import type { OrganizationMember, Team } from '@/types';

export default function TeamsPage() {
  const { currentOrg } = useSelector((s: RootState) => s.auth);
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [teamModal, setTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', currentOrg?.id],
    queryFn: async () => (await get<Team[]>('/teams')).data || [],
    enabled: Boolean(currentOrg?.id),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['orgMembers', currentOrg?.id],
    queryFn: async () =>
      (await get<OrganizationMember[]>(`/organizations/${currentOrg!.id}/members`)).data || [],
    enabled: Boolean(currentOrg?.id),
  });

  const { mutateAsync: createTeam, isPending: creating } = useMutation({
    mutationFn: () => post<Team>('/teams', { name: teamName, description: teamDesc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setTeamName('');
      setTeamDesc('');
      setTeamModal(false);
      addToast('Team created', 'success');
    },
  });

  const { mutateAsync: inviteMember, isPending: inviting } = useMutation({
    mutationFn: (values: InviteMemberValues) =>
      post(`/organizations/${currentOrg!.id}/invitations`, values),
    onSuccess: () => addToast('Invitation sent', 'success'),
  });

  if (loadingTeams) return <LoadingSpinner label="Loading teams..." />;

  const canManage = currentOrg?.role === 'owner' || currentOrg?.role === 'project_manager';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Teams & Members</h1>
          <p className="text-sm text-secondary-500">Organize departments and invite organization members.</p>
        </div>
        {canManage && (
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setTeamModal(true)}>
            Create Team
          </Button>
        )}
      </div>

      {canManage && (
        <Card title="Invite Organization Member">
          <InviteMemberForm
            onSubmit={async (v) => {
              await inviteMember(v);
            }}
            loading={inviting}
          />
        </Card>
      )}

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No teams created"
          description="Create teams to group engineers, designers, and project managers."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Card key={t.id} title={t.name}>
              <p className="text-sm text-secondary-600">{t.description || 'No description'}</p>
            </Card>
          ))}
        </div>
      )}

      <Card title={`Organization Members (${members.length})`}>
        <div className="divide-y divide-secondary-100">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-secondary-900">
                  {m.first_name} {m.last_name}
                </p>
                <p className="text-xs text-secondary-500">{m.email}</p>
              </div>
              <Badge variant="info">{m.role.replace('_', ' ')}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={teamModal} onClose={() => setTeamModal(false)} title="New Team">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTeam();
          }}
          className="space-y-4"
        >
          <Input label="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
          <Input label="Description" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTeamModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create Team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

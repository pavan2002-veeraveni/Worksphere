import { teamRepository } from '../repositories/teamRepository';
import { ApiError } from '../utils/ApiError';

export const teamService = {
  async list(orgId: string, limit: number, offset: number) {
    return teamRepository.findByOrgId(orgId, limit, offset);
  },

  async getById(orgId: string, teamId: string) {
    const team = await teamRepository.findById(orgId, teamId);
    if (!team) throw ApiError.notFound('Team not found');
    return team;
  },

  async create(orgId: string, data: { name: string; description?: string | null }) {
    return teamRepository.create(orgId, data);
  },

  async update(orgId: string, teamId: string, data: { name?: string; description?: string | null }) {
    const updated = await teamRepository.update(orgId, teamId, data);
    if (!updated) throw ApiError.notFound('Team not found');
    return updated;
  },

  async remove(orgId: string, teamId: string) {
    const deleted = await teamRepository.delete(orgId, teamId);
    if (!deleted) throw ApiError.notFound('Team not found');
  },

  async addMember(orgId: string, teamId: string, userId: string, role: string) {
    await this.getById(orgId, teamId);
    return teamRepository.addMember(teamId, userId, role);
  },

  async removeMember(orgId: string, teamId: string, userId: string) {
    await this.getById(orgId, teamId);
    const deleted = await teamRepository.removeMember(teamId, userId);
    if (!deleted) throw ApiError.notFound('Team member not found');
  },
};

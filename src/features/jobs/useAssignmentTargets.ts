import { useMemo } from 'react';
import type { AssignmentActor } from '@/types/domain';
import { useGetUsersQuery } from '@/api/baseApi';
import { useAppSelector } from '@/store/hooks';
import { selectAllUsers, selectTeamMembership } from '@/features/teamlead/teamSlice';
import { validAssignmentTargets } from '@/config/rules/assignment';

/**
 * Fetches (and merges into Dexie/Redux via the usual RTK Query flow) the roster this actor is
 * allowed to assign to, then narrows it through validAssignmentTargets() — the single source
 * of truth for assignment-target computation.
 *
 * Inactive users are dropped at the API boundary (getUsers filters isActive), and displayName -> name
 * with email fallback is mapped in baseApi's mapApiSurveyor, so this hook only joins targets to names.
 */
export function useAssignmentTargets(currentUser: AssignmentActor | null) {
  const role = currentUser?.role === 'Manager' ? 'teamlead' : 'surveyor';
  const { isLoading, isError } = useGetUsersQuery({ role }, { skip: !currentUser });

  const membership = useAppSelector(selectTeamMembership);
  const users = useAppSelector(selectAllUsers);

  // selectCurrentActor returns a new object each call, so key on its primitive fields.
  const actorUserId = currentUser?.userId;
  const actorRole = currentUser?.role;

  const targets = useMemo(() => {
    if (!actorUserId || !actorRole) return [];
    const actor: AssignmentActor = { userId: actorUserId, role: actorRole };
    const namesById = new Map(users.map((u) => [u.id, u.name]));
    return validAssignmentTargets(actor, membership).map((target) => ({
      actor: target,
      name: namesById.get(target.userId) || target.userId,
    }));
  }, [actorUserId, actorRole, membership, users]);

  return { targets, isLoading, isError };
}

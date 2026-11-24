import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TeamMembership, User, Role } from '@/types/domain';

interface TeamState {
  users: Record<string, User>;
}

const initialState: TeamState = {
  users: {},
};

const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {
    usersHydrated(state, action: PayloadAction<User[]>) {
      state.users = Object.fromEntries(action.payload.map((u) => [u.id, u]));
    },
    usersUpserted(state, action: PayloadAction<User[]>) {
      for (const user of action.payload) {
        state.users[user.id] = user;
      }
    },
    usersReplacedForRole(state, action: PayloadAction<{ role: Role; users: User[] }>) {
      const { role, users } = action.payload;
      for (const [id, user] of Object.entries(state.users)) {
        if (user.role === role) delete state.users[id];
      }
      for (const user of users) {
        state.users[user.id] = user;
      }
    },
  },
});

export const { usersHydrated, usersUpserted, usersReplacedForRole } = teamSlice.actions;
export default teamSlice.reducer;

const selectUserMap = (state: { team: TeamState }) => state.team.users;

export const selectAllUsers = createSelector(selectUserMap, (users): User[] => Object.values(users));

// Memoized so consumers (e.g. useAssignmentTargets' useMemo) see a stable reference between unrelated store updates.
export const selectTeamMembership = createSelector(
  selectAllUsers,
  (users): TeamMembership => ({
    allTeamLeads: users
      .filter((u) => u.role === 'TeamLead')
      .map((u) => ({ userId: u.id, role: u.role as Role })),
    // The surveyors list carries no team link, so every active surveyor is a target for any Team Lead.
    surveyorsOf: () =>
      users
        .filter((u) => u.role === 'Surveyor')
        .map((u) => ({ userId: u.id, role: u.role as Role })),
  }),
);

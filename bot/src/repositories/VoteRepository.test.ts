import { VoteRepository } from './VoteRepository';

// Mock Firestore
const mockDoc = {
  id: 'vote123',
  exists: true,
  data: () => ({
    contestId: 'contest1',
    submissionId: 'submission1',
    voterId: 'voter1',
  }),
  ref: {
    delete: jest.fn().mockResolvedValue(undefined),
  },
};

const mockQuerySnapshot = {
  empty: false,
  docs: [mockDoc],
};

const mockEmptySnapshot = {
  empty: true,
  docs: [],
};

const mockCountSnapshot = {
  data: () => ({ count: 5 }),
};

const mockCollection = {
  add: jest.fn().mockResolvedValue({ id: 'newvote123' }),
  doc: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(mockDoc),
    delete: jest.fn().mockResolvedValue(undefined),
  }),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(mockCountSnapshot),
  }),
  get: jest.fn().mockResolvedValue(mockQuerySnapshot),
};

const mockFirestore = {
  collection: jest.fn().mockReturnValue(mockCollection),
};

describe('VoteRepository', () => {
  let repository: VoteRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new VoteRepository(mockFirestore as any);
  });

  describe('create', () => {
    it('should create a vote and return with id', async () => {
      const voteData = {
        contestId: 'contest1',
        submissionId: 'submission1',
        voterId: 'voter1',
        createdAt: new Date(),
      };

      const result = await repository.create(voteData);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          contestId: 'contest1',
          submissionId: 'submission1',
          voterId: 'voter1',
          createdAt: expect.any(Date),
        })
      );
      expect(result.id).toBe('newvote123');
    });
  });

  describe('getById', () => {
    it('should return vote when found', async () => {
      const result = await repository.getById('vote123');

      expect(result).toEqual({
        id: 'vote123',
        contestId: 'contest1',
        submissionId: 'submission1',
        voterId: 'voter1',
      });
    });

    it('should return null when not found', async () => {
      mockCollection.doc.mockReturnValueOnce({
        get: jest.fn().mockResolvedValue({ exists: false }),
      });

      const result = await repository.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByContestId', () => {
    it('should return votes for contest', async () => {
      const result = await repository.getByContestId('contest1');

      expect(mockCollection.where).toHaveBeenCalledWith('contestId', '==', 'contest1');
      expect(result).toHaveLength(1);
      expect(result[0].contestId).toBe('contest1');
    });
  });

  describe('getByVoterAndContest', () => {
    it('should filter by both voter and contest', async () => {
      await repository.getByVoterAndContest('voter1', 'contest1');

      expect(mockCollection.where).toHaveBeenCalledWith('contestId', '==', 'contest1');
      expect(mockCollection.where).toHaveBeenCalledWith('voterId', '==', 'voter1');
    });
  });

  describe('countByVoterAndContest', () => {
    it('should return count of votes', async () => {
      const result = await repository.countByVoterAndContest('voter1', 'contest1');

      expect(result).toBe(5);
    });
  });

  describe('hasVoted', () => {
    it('should return true when vote exists', async () => {
      const result = await repository.hasVoted('voter1', 'submission1');

      expect(mockCollection.where).toHaveBeenCalledWith('voterId', '==', 'voter1');
      expect(mockCollection.where).toHaveBeenCalledWith('submissionId', '==', 'submission1');
      expect(mockCollection.limit).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should return false when vote does not exist', async () => {
      mockCollection.get.mockResolvedValueOnce(mockEmptySnapshot);

      const result = await repository.hasVoted('voter2', 'submission1');

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete vote by id', async () => {
      const mockDocRef = {
        delete: jest.fn().mockResolvedValue(undefined),
      };
      mockCollection.doc.mockReturnValueOnce(mockDocRef);

      await repository.delete('vote123');

      expect(mockCollection.doc).toHaveBeenCalledWith('vote123');
      expect(mockDocRef.delete).toHaveBeenCalled();
    });
  });

  describe('deleteByVoterAndSubmission', () => {
    it('should find and delete vote', async () => {
      await repository.deleteByVoterAndSubmission('voter1', 'submission1');

      expect(mockCollection.where).toHaveBeenCalledWith('voterId', '==', 'voter1');
      expect(mockCollection.where).toHaveBeenCalledWith('submissionId', '==', 'submission1');
      expect(mockDoc.ref.delete).toHaveBeenCalled();
    });

    it('should not throw when vote does not exist', async () => {
      mockCollection.get.mockResolvedValueOnce(mockEmptySnapshot);

      await expect(
        repository.deleteByVoterAndSubmission('voter2', 'submission1')
      ).resolves.not.toThrow();
    });
  });

  describe('getVoteCountsByContest', () => {
    it('should return map of submission id to vote count', async () => {
      const mockVotes = {
        empty: false,
        docs: [
          { id: 'v1', data: () => ({ submissionId: 's1' }) },
          { id: 'v2', data: () => ({ submissionId: 's1' }) },
          { id: 'v3', data: () => ({ submissionId: 's2' }) },
        ],
      };
      mockCollection.get.mockResolvedValueOnce(mockVotes);

      const result = await repository.getVoteCountsByContest('contest1');

      expect(result.get('s1')).toBe(2);
      expect(result.get('s2')).toBe(1);
    });
  });
});

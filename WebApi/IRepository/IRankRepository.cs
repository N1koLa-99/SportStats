using SpoerStats2.Models;

namespace SpoerStats2.Repository
{
    public interface IRankRepository
    {
        Task<IEnumerable<Rank>> GetAllRanks();
        Task<Rank> GetRankById(int id);
        Task AddRank(Rank rank);
        Task UpdateRank(Rank rank);
        Task DeleteRank(int id);
    }

}

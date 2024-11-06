using SpoerStats2.Models;

namespace SpoerStats2.Repository
{
    public interface IRankingRepository
    {
        Task<IEnumerable<Ranking>> GetAllRankings();
        Task<Ranking> GetRankingById(int id);
        Task<IEnumerable<Ranking>> GetRankingsByUserId(int userId);
        Task AddRanking(Ranking ranking);
        Task UpdateRanking(Ranking ranking);
        Task DeleteRanking(int id);
        Task<double> GetTotalPointsByUserId(int userId);
        Task<Rank> GetRankById(int rankId); 
    }

}

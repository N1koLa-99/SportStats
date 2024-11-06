using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

public class RankingService
{
    private readonly IRankingRepository _rankingRepository;

    public RankingService(IRankingRepository rankingRepository)
    {
        _rankingRepository = rankingRepository;
    }

    public async Task<IEnumerable<Ranking>> GetAllRankings()
    {
        return await _rankingRepository.GetAllRankings();
    }

    public async Task<Ranking> GetRankingById(int id)
    {
        return await _rankingRepository.GetRankingById(id);
    }

    public async Task AddRanking(Ranking ranking)
    {
        await _rankingRepository.AddRanking(ranking);
    }

    public async Task UpdateRanking(Ranking ranking)
    {
        await _rankingRepository.UpdateRanking(ranking);
    }

    public async Task DeleteRanking(int id)
    {
        await _rankingRepository.DeleteRanking(id);
    }
    public async Task<double> GetTotalPointsByUserId(int userId)
    {
        return await _rankingRepository.GetTotalPointsByUserId(userId);
    }
    public async Task<object> GetTotalPointsAndRankByUserId(int userId)
    {
        var rankings = await _rankingRepository.GetRankingsByUserId(userId);
        var results = new List<object>();

        foreach (var ranking in rankings)
        {
            var rank = await _rankingRepository.GetRankById(ranking.RankId);
            results.Add(new
            {
                TotalPoints = ranking.TotalPoints,
                RankName = rank?.RankName // Уверете се, че RankName не е null
            });
        }

        return results;
    }

}

using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

public class RankService
{
    private readonly IRankRepository _rankRepository;

    public RankService(IRankRepository rankRepository)
    {
        _rankRepository = rankRepository;
    }

    public async Task<IEnumerable<Rank>> GetAllRanks()
    {
        return await _rankRepository.GetAllRanks();
    }

    public async Task<Rank> GetRankById(int id)
    {
        return await _rankRepository.GetRankById(id);
    }

    public async Task AddRank(Rank rank)
    {
        await _rankRepository.AddRank(rank);
    }

    public async Task UpdateRank(Rank rank)
    {
        await _rankRepository.UpdateRank(rank);
    }

    public async Task DeleteRank(int id)
    {
        await _rankRepository.DeleteRank(id);
    }
}

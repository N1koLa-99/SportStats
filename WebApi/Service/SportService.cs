using SpoerStats2.IRepository;
using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

public class SportService
{
    private readonly ISportRepository _sportRepository;

    public SportService(ISportRepository sportRepository)
    {
        _sportRepository = sportRepository;
    }

    public async Task<IEnumerable<Sport>> GetAllSports()
    {
        return await _sportRepository.GetAllSports();
    }

    public async Task<Sport> GetSportById(int id)
    {
        return await _sportRepository.GetSportById(id);
    }

    public async Task AddSport(Sport sport)
    {
        await _sportRepository.AddSport(sport);
    }

    public async Task UpdateSport(Sport sport)
    {
        await _sportRepository.UpdateSport(sport);
    }

    public async Task DeleteSport(int id)
    {
        await _sportRepository.DeleteSport(id);
    }
}

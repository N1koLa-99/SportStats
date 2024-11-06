using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

public class ClubService
{
    private readonly IClubRepository _clubRepository;

    public ClubService(IClubRepository clubRepository)
    {
        _clubRepository = clubRepository;
    }

    public async Task<IEnumerable<Club>> GetAllClubs()
    {
        return await _clubRepository.GetAllClubs();
    }

    public async Task<Club> GetClubById(int id)
    {
        return await _clubRepository.GetClubById(id);
    }

    public async Task AddClub(Club club)
    {
        await _clubRepository.AddClub(club);
    }

    public async Task UpdateClub(Club club)
    {
        await _clubRepository.UpdateClub(club);
    }

    public async Task DeleteClub(int id)
    {
        await _clubRepository.DeleteClub(id);
    }
}

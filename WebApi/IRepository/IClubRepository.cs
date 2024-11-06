using SpoerStats2.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Repository
{
    public interface IClubRepository
    {
        Task<IEnumerable<Club>> GetAllClubs();
        Task<Club> GetClubById(int id);
        Task AddClub(Club club);
        Task UpdateClub(Club club);
        Task DeleteClub(int id);
    }
}

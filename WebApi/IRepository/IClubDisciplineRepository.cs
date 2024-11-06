using SpoerStats2.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Repository
{
    public interface IClubDisciplineRepository
    {
        Task<IEnumerable<ClubDiscipline>> GetAllClubDisciplines();
        Task<ClubDiscipline> GetClubDisciplineById(int id);
        Task<IEnumerable<ClubDiscipline>> GetClubDisciplinesByClubId(int clubId);
        Task AddClubDiscipline(ClubDiscipline clubDiscipline);
        Task UpdateClubDiscipline(ClubDiscipline clubDiscipline);
        Task DeleteClubDiscipline(int id);

    }
}

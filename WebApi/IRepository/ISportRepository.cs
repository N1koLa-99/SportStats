using SpoerStats2.Models;

namespace SpoerStats2.IRepository
{
    public interface ISportRepository
    {
        Task<IEnumerable<Sport>> GetAllSports();
        Task<Sport> GetSportById(int id);
        Task AddSport(Sport sport);
        Task UpdateSport(Sport sport);
        Task DeleteSport(int id);
    }
}

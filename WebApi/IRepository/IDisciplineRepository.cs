using SpoerStats2.Models;

namespace SpoerStats2.Repository
{
    public interface IDisciplineRepository
    {
        Task<IEnumerable<Discipline>> GetAllDisciplines();
        Task<Discipline> GetDisciplineById(int id);
        Task<IEnumerable<Discipline>> GetDisciplinesBySportId(int sportId);
        Task AddDiscipline(Discipline discipline);
        Task UpdateDiscipline(Discipline discipline);
        Task DeleteDiscipline(int id);
        Task<IEnumerable<Discipline>> GetDisciplinesByIds(IEnumerable<int> ids);
    }

}

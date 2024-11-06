using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

public class DisciplineService
{
    private readonly IDisciplineRepository _disciplineRepository;

    public DisciplineService(IDisciplineRepository disciplineRepository)
    {
        _disciplineRepository = disciplineRepository;
    }

    public async Task<IEnumerable<Discipline>> GetAllDisciplines()
    {
        return await _disciplineRepository.GetAllDisciplines();
    }

    public async Task<Discipline> GetDisciplineById(int id)
    {
        return await _disciplineRepository.GetDisciplineById(id);
    }

    public async Task AddDiscipline(Discipline discipline)
    {
        await _disciplineRepository.AddDiscipline(discipline);
    }

    public async Task UpdateDiscipline(Discipline discipline)
    {
        await _disciplineRepository.UpdateDiscipline(discipline);
    }

    public async Task DeleteDiscipline(int id)
    {
        await _disciplineRepository.DeleteDiscipline(id);
    }
}

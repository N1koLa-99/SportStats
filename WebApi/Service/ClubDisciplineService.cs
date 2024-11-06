using SpoerStats2.ClassRepository;
using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class ClubDisciplineService
{
    private readonly IClubDisciplineRepository _clubDisciplineRepository;
    private readonly IDisciplineRepository _disciplineRepository;

    public ClubDisciplineService(IClubDisciplineRepository clubDisciplineRepository, IDisciplineRepository disciplineRepository)
    {
        _clubDisciplineRepository = clubDisciplineRepository;
        _disciplineRepository = disciplineRepository;
    }

    public async Task<IEnumerable<ClubDiscipline>> GetAllClubDisciplines()
    {
        return await _clubDisciplineRepository.GetAllClubDisciplines();
    }

    public async Task<ClubDiscipline> GetClubDisciplineById(int id)
    {
        return await _clubDisciplineRepository.GetClubDisciplineById(id);
    }

    public async Task<IEnumerable<ClubDiscipline>> GetClubDisciplinesByClubId(int clubId)
    {
        return await _clubDisciplineRepository.GetClubDisciplinesByClubId(clubId);
    }

    public async Task AddClubDiscipline(ClubDiscipline clubDiscipline)
    {
        await _clubDisciplineRepository.AddClubDiscipline(clubDiscipline);
    }

    public async Task UpdateClubDiscipline(ClubDiscipline clubDiscipline)
    {
        await _clubDisciplineRepository.UpdateClubDiscipline(clubDiscipline);
    }

    public async Task DeleteClubDiscipline(int id)
    {
        await _clubDisciplineRepository.DeleteClubDiscipline(id);
    }

    public async Task<IEnumerable<Discipline>> GetDisciplinesByClubId(int clubId)
    {
        // Получаваме всички дисциплини, свързани с клуба
        var clubDisciplines = await GetClubDisciplinesByClubId(clubId);

        // Извличаме ID на дисциплините от резултата
        var disciplineIds = clubDisciplines.Select(cd => cd.DisciplineId);

        // Извличаме дисциплините по техните ID
        return await _disciplineRepository.GetDisciplinesByIds(disciplineIds);
    }
}

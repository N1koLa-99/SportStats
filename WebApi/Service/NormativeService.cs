using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

public class NormativeService
{
    private readonly INormativeRepository _normativeRepository;

    public NormativeService(INormativeRepository normativeRepository)
    {
        _normativeRepository = normativeRepository;
    }

    public async Task<IEnumerable<Normative>> GetAllNormatives()
    {
        return await _normativeRepository.GetAllNormatives();
    }

    public async Task<Normative> GetNormativeById(int id)
    {
        return await _normativeRepository.GetNormativeById(id);
    }

    public async Task AddNormative(Normative normative)
    {
        await _normativeRepository.AddNormative(normative);
    }

    public async Task UpdateNormative(Normative normative)
    {
        await _normativeRepository.UpdateNormative(normative);
    }

    public async Task DeleteNormative(int id)
    {
        await _normativeRepository.DeleteNormative(id);
    }
    public async Task<IEnumerable<Normative>> GetNormativesByDisciplineId(int disciplineId)
    {
        return await _normativeRepository.GetNormativesByDisciplineId(disciplineId);
    }

}

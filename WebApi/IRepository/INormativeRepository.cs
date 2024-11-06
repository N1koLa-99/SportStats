using SpoerStats2.Models;

public interface INormativeRepository
{
    Task<IEnumerable<Normative>> GetAllNormatives();
    Task<Normative> GetNormativeById(int id);
    Task<IEnumerable<Normative>> GetNormativesByDisciplineId(int disciplineId);
    Task AddNormative(Normative normative);
    Task UpdateNormative(Normative normative);
    Task DeleteNormative(int id);
}

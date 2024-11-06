using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DisciplinesController : ControllerBase
    {
        private readonly IDisciplineRepository _disciplineRepository;

        public DisciplinesController(IDisciplineRepository disciplineRepository)
        {
            _disciplineRepository = disciplineRepository;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Discipline>>> GetDisciplines()
        {
            return Ok(await _disciplineRepository.GetAllDisciplines());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Discipline>> GetDiscipline(int id)
        {
            var discipline = await _disciplineRepository.GetDisciplineById(id);
            if (discipline == null) return NotFound();
            return Ok(discipline);
        }

        [HttpPost]
        public async Task<ActionResult<Discipline>> PostDiscipline(Discipline discipline)
        {
            await _disciplineRepository.AddDiscipline(discipline);
            return CreatedAtAction("GetDiscipline", new { id = discipline.Id }, discipline);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutDiscipline(int id, Discipline discipline)
        {
            if (id != discipline.Id) return BadRequest();
            await _disciplineRepository.UpdateDiscipline(discipline);
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDiscipline(int id)
        {
            var discipline = await _disciplineRepository.GetDisciplineById(id);
            if (discipline == null) return NotFound();
            await _disciplineRepository.DeleteDiscipline(id);
            return NoContent();
        }   
    }
}

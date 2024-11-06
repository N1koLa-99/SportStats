namespace SpoerStats2.Models
{
    public class Normative
    {
        public int Id { get; set; }
        public int DisciplineId { get; set; }
        public string Gender { get; set; }
        public int MinAge { get; set; }
        public int MaxAge { get; set; }
        public decimal ValueStandart { get; set; }
        public int Points { get; set; }
        public int SwimmingPoolStandartId { get; set; }
    }
}

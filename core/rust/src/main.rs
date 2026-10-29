use std::io::{self, Read};
fn main() {
    let mut bytes = Vec::new();
    if io::stdin()
        .take(distill_pets_core::MAX_INPUT as u64 + 1)
        .read_to_end(&mut bytes)
        .is_err()
    {
        eprintln!("Could not read input");
        std::process::exit(1);
    }
    let result = distill_pets_core::evaluate(&bytes);
    println!("{}", result);
    if result["ok"] != true {
        std::process::exit(1);
    }
}
